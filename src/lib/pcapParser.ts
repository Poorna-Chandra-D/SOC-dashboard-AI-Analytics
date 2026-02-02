export type PcapSummary = {
  totalPackets: number;
  totalBytes: number;
  ipv4Packets: number;
  unknownPackets: number;
  tcpPackets: number;
  udpPackets: number;
  dnsPackets: number;
  httpPackets: number;
  tlsPackets: number;
  startTime?: string;
  endTime?: string;
};

export type PcapEventAggregate = {
  source_ip: string;
  destination_ip: string;
  protocol: string;
  src_port?: number;
  dst_port?: number;
  app_protocol?: 'DNS' | 'HTTP' | 'TLS';
  details?: {
    dns?: {
      query: string;
      type: string;
    };
    http?: {
      method?: string;
      host?: string;
      path?: string;
      status?: string;
    };
    tls?: {
      sni?: string;
      version?: string;
    };
  };
  bytes_transferred: number;
  packets: number;
};

export type PcapParseResult = {
  summary: PcapSummary;
  events: PcapEventAggregate[];
  warnings: string[];
};

const PCAP_MAGIC = 0xa1b2c3d4;
const PCAP_MAGIC_NS = 0xa1b23c4d;
const PCAPNG_MAGIC = 0x0a0d0d0a;

function formatTimestamp(seconds: number, fraction: number, nanoPrecision: boolean): string {
  const millis = seconds * 1000 + (nanoPrecision ? fraction / 1e6 : fraction / 1e3);
  return new Date(millis).toISOString();
}

function readUint32(view: DataView, offset: number, littleEndian: boolean) {
  return view.getUint32(offset, littleEndian);
}

function readUint16(view: DataView, offset: number, littleEndian = false) {
  return view.getUint16(offset, littleEndian);
}

function parseIPv4(packet: Uint8Array) {
  if (packet.length < 34) return null; // ethernet (14) + ipv4 min (20)
  const etherType = (packet[12] << 8) | packet[13];
  if (etherType !== 0x0800) return null;
  const ipOffset = 14;
  const versionIhl = packet[ipOffset];
  const version = versionIhl >> 4;
  if (version !== 4) return null;
  const ihl = (versionIhl & 0x0f) * 4;
  if (packet.length < ipOffset + ihl) return null;
  const protocolByte = packet[ipOffset + 9];
  const src = `${packet[ipOffset + 12]}.${packet[ipOffset + 13]}.${packet[ipOffset + 14]}.${packet[ipOffset + 15]}`;
  const dst = `${packet[ipOffset + 16]}.${packet[ipOffset + 17]}.${packet[ipOffset + 18]}.${packet[ipOffset + 19]}`;
  let protocol = `IP-${protocolByte}`;
  if (protocolByte === 6) protocol = 'TCP';
  else if (protocolByte === 17) protocol = 'UDP';
  else if (protocolByte === 1) protocol = 'ICMP';
  const payloadOffset = ipOffset + ihl;
  if (packet.length < payloadOffset) return null;
  return { src, dst, protocol, protocolByte, payloadOffset };
}

function parseTcp(packet: Uint8Array, offset: number) {
  if (packet.length < offset + 20) return null;
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  const srcPort = readUint16(view, offset);
  const dstPort = readUint16(view, offset + 2);
  const dataOffset = (packet[offset + 12] >> 4) * 4;
  const payloadOffset = offset + dataOffset;
  if (packet.length < payloadOffset) return null;
  return { srcPort, dstPort, payload: packet.slice(payloadOffset) };
}

function parseUdp(packet: Uint8Array, offset: number) {
  if (packet.length < offset + 8) return null;
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  const srcPort = readUint16(view, offset);
  const dstPort = readUint16(view, offset + 2);
  const payloadOffset = offset + 8;
  if (packet.length < payloadOffset) return null;
  return { srcPort, dstPort, payload: packet.slice(payloadOffset) };
}

function parseDns(payload: Uint8Array) {
  if (payload.length < 12) return null;
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const qdCount = readUint16(view, 4);
  if (qdCount < 1) return null;
  let offset = 12;
  const labels: string[] = [];
  let safety = 0;
  while (offset < payload.length) {
    if (safety++ > 50) return null;
    const len = payload[offset];
    if (len === 0) {
      offset += 1;
      break;
    }
    if ((len & 0xc0) === 0xc0) {
      // name compression pointer
      offset += 2;
      labels.push('<pointer>');
      break;
    }
    if (offset + 1 + len > payload.length) return null;
    const label = new TextDecoder().decode(payload.slice(offset + 1, offset + 1 + len));
    labels.push(label);
    offset += 1 + len;
  }
  if (offset + 4 > payload.length) return null;
  const qtype = readUint16(view, offset);
  const typeMap: Record<number, string> = {
    1: 'A',
    28: 'AAAA',
    15: 'MX',
    16: 'TXT',
    12: 'PTR',
    5: 'CNAME',
  };
  return {
    query: labels.filter(Boolean).join('.'),
    type: typeMap[qtype] || `TYPE${qtype}`,
  };
}

function parseHttp(payload: Uint8Array) {
  if (payload.length < 4) return null;
  const text = new TextDecoder().decode(payload.slice(0, Math.min(payload.length, 2048)));
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return null;
  const requestMatch = /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT)\s+(\S+)\s+HTTP\/(\d\.\d)/i.exec(lines[0]);
  const responseMatch = /^HTTP\/(\d\.\d)\s+(\d{3})\s*(.*)$/i.exec(lines[0]);
  if (!requestMatch && !responseMatch) return null;
  let host: string | undefined;
  for (const line of lines) {
    const hostMatch = /^Host:\s*(.+)$/i.exec(line);
    if (hostMatch) {
      host = hostMatch[1].trim();
      break;
    }
  }
  if (requestMatch) {
    return {
      method: requestMatch[1].toUpperCase(),
      path: requestMatch[2],
      host,
    };
  }
  return {
    status: responseMatch?.[2],
    host,
  };
}

function parseTlsClientHello(payload: Uint8Array) {
  if (payload.length < 5) return null;
  const contentType = payload[0];
  if (contentType !== 22) return null; // handshake
  const versionMajor = payload[1];
  const versionMinor = payload[2];
  const recordLength = (payload[3] << 8) | payload[4];
  if (payload.length < 5 + recordLength) return null;
  const handshakeType = payload[5];
  if (handshakeType !== 1) return null; // ClientHello
  let offset = 5 + 4; // handshake header
  offset += 2; // client version
  offset += 32; // random
  if (offset >= payload.length) return null;
  const sessionIdLen = payload[offset];
  offset += 1 + sessionIdLen;
  if (offset + 2 > payload.length) return null;
  const cipherLen = (payload[offset] << 8) | payload[offset + 1];
  offset += 2 + cipherLen;
  if (offset >= payload.length) return null;
  const compressionLen = payload[offset];
  offset += 1 + compressionLen;
  if (offset + 2 > payload.length) return null;
  const extensionsLen = (payload[offset] << 8) | payload[offset + 1];
  offset += 2;
  const extensionsEnd = offset + extensionsLen;
  let sni: string | undefined;
  while (offset + 4 <= extensionsEnd && offset + 4 <= payload.length) {
    const extType = (payload[offset] << 8) | payload[offset + 1];
    const extLen = (payload[offset + 2] << 8) | payload[offset + 3];
    offset += 4;
    if (extType === 0x00 && offset + extLen <= payload.length) {
      const listLen = (payload[offset] << 8) | payload[offset + 1];
      let listOffset = offset + 2;
      if (listOffset + listLen <= payload.length) {
        const nameType = payload[listOffset];
        const nameLen = (payload[listOffset + 1] << 8) | payload[listOffset + 2];
        const nameStart = listOffset + 3;
        if (nameType === 0 && nameStart + nameLen <= payload.length) {
          sni = new TextDecoder().decode(payload.slice(nameStart, nameStart + nameLen));
          break;
        }
      }
    }
    offset += extLen;
  }
  const versionLabel = `TLS ${versionMajor}.${versionMinor}`;
  return { sni, version: versionLabel };
}

export async function parsePcapFile(file: File): Promise<PcapParseResult> {
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength < 24) {
    throw new Error('File is too small to be a valid PCAP.');
  }

  const view = new DataView(buffer);
  const magicBE = view.getUint32(0, false);
  const magicLE = view.getUint32(0, true);

  if (magicBE === PCAPNG_MAGIC || magicLE === PCAPNG_MAGIC) {
    throw new Error('PCAPNG detected. Export as PCAP (Wireshark: File → Export Specified Packets → libpcap).');
  }

  let littleEndian = false;
  let nanoPrecision = false;
  if (magicBE === PCAP_MAGIC) {
    littleEndian = false;
  } else if (magicLE === PCAP_MAGIC) {
    littleEndian = true;
  } else if (magicBE === PCAP_MAGIC_NS) {
    littleEndian = false;
    nanoPrecision = true;
  } else if (magicLE === PCAP_MAGIC_NS) {
    littleEndian = true;
    nanoPrecision = true;
  } else {
    throw new Error('Unsupported PCAP format.');
  }

  const summary: PcapSummary = {
    totalPackets: 0,
    totalBytes: 0,
    ipv4Packets: 0,
    unknownPackets: 0,
    tcpPackets: 0,
    udpPackets: 0,
    dnsPackets: 0,
    httpPackets: 0,
    tlsPackets: 0,
  };

  const warnings: string[] = [];
  const aggregates = new Map<string, PcapEventAggregate>();

  let offset = 24;
  let firstTimestamp: string | undefined;
  let lastTimestamp: string | undefined;

  while (offset + 16 <= buffer.byteLength) {
    const tsSec = readUint32(view, offset, littleEndian);
    const tsFrac = readUint32(view, offset + 4, littleEndian);
    const inclLen = readUint32(view, offset + 8, littleEndian);
    const origLen = readUint32(view, offset + 12, littleEndian);

    const packetStart = offset + 16;
    const packetEnd = packetStart + inclLen;
    if (inclLen === 0 || packetEnd > buffer.byteLength) {
      warnings.push('Encountered malformed packet length. Parsing stopped early.');
      break;
    }

    const timestamp = formatTimestamp(tsSec, tsFrac, nanoPrecision);
    if (!firstTimestamp) firstTimestamp = timestamp;
    lastTimestamp = timestamp;

    summary.totalPackets += 1;
    summary.totalBytes += origLen || inclLen;

    const packet = new Uint8Array(buffer, packetStart, inclLen);
    const ipv4 = parseIPv4(packet);
    if (!ipv4) {
      summary.unknownPackets += 1;
      offset = packetEnd;
      continue;
    }

    summary.ipv4Packets += 1;
    let srcPort: number | undefined;
    let dstPort: number | undefined;
    let appProtocol: 'DNS' | 'HTTP' | 'TLS' | undefined;
    let details: PcapEventAggregate['details'] | undefined;

    if (ipv4.protocol === 'TCP') {
      summary.tcpPackets += 1;
      const tcp = parseTcp(packet, ipv4.payloadOffset);
      if (tcp) {
        srcPort = tcp.srcPort;
        dstPort = tcp.dstPort;
        const http = parseHttp(tcp.payload);
        if (http) {
          appProtocol = 'HTTP';
          details = { http };
          summary.httpPackets += 1;
        } else {
          const tls = parseTlsClientHello(tcp.payload);
          if (tls) {
            appProtocol = 'TLS';
            details = { tls };
            summary.tlsPackets += 1;
          }
        }
      }
    } else if (ipv4.protocol === 'UDP') {
      summary.udpPackets += 1;
      const udp = parseUdp(packet, ipv4.payloadOffset);
      if (udp) {
        srcPort = udp.srcPort;
        dstPort = udp.dstPort;
        if (udp.srcPort === 53 || udp.dstPort === 53) {
          const dns = parseDns(udp.payload);
          if (dns) {
            appProtocol = 'DNS';
            details = { dns };
            summary.dnsPackets += 1;
          }
        }
      }
    }

    const key = `${ipv4.src}|${ipv4.dst}|${ipv4.protocol}|${srcPort ?? ''}|${dstPort ?? ''}|${appProtocol ?? ''}`;
    const existing = aggregates.get(key);
    if (existing) {
      existing.packets += 1;
      existing.bytes_transferred += inclLen;
      if (!existing.details && details) {
        existing.details = details;
      }
    } else {
      aggregates.set(key, {
        source_ip: ipv4.src,
        destination_ip: ipv4.dst,
        protocol: ipv4.protocol,
        src_port: srcPort,
        dst_port: dstPort,
        app_protocol: appProtocol,
        details,
        packets: 1,
        bytes_transferred: inclLen,
      });
    }

    offset = packetEnd;
  }

  summary.startTime = firstTimestamp;
  summary.endTime = lastTimestamp;

  return {
    summary,
    events: Array.from(aggregates.values()).sort((a, b) => b.bytes_transferred - a.bytes_transferred),
    warnings,
  };
}
