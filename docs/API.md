# Brows VPN - API Documentation

> **Обновлено:** 2026-05-22  
> **Статус:** спецификация целевого API; в коде реализованы только `enable_vpn`, `disable_vpn`, `get_status` (handler — заглушка).  
> **План:** [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)

## Native Messaging Protocol

### Overview

Communication between browser extension and local proxy service uses Chrome Native Messaging Protocol with custom JSON-based message format.

### Protocol Specification

#### Message Format

All messages follow this structure:

```json
{
  "version": "1.0",
  "message_type": "command|response|event",
  "timestamp": "ISO8601 timestamp",
  "message_id": "unique_identifier",
  "payload": {
    // Message-specific data
  }
}
```

#### Message Types

**command**: Messages sent from extension to service
**response**: Messages sent from service to extension (in response to commands)
**event**: Asynchronous messages sent from service to extension

### Command Messages

#### Enable VPN

Enables VPN connection with specified configuration.

**Request**
```json
{
  "version": "1.0",
  "message_type": "command",
  "timestamp": "2024-01-01T00:00:00Z",
  "message_id": "cmd_001",
  "payload": {
    "command": "enable_vpn",
    "config": {
      "vless_url": "vless://uuid@address:port?type=grpc&encryption=none&serviceName=vpn&security=reality&pbk=publicKey&fp=chrome&sni=serverName&sid=sessionId&spx=%2F#name",
      "mode": "selective",
      "socks_port": 1080,
      "dns_override": true,
      "log_level": "info"
    }
  }
}
```

**Response (Success)**
```json
{
  "version": "1.0",
  "message_type": "response",
  "timestamp": "2024-01-01T00:00:01Z",
  "message_id": "cmd_001",
  "payload": {
    "status": "success",
    "data": {
      "vpn_status": "connecting",
      "config_id": "config_12345",
      "socks_proxy": "127.0.0.1:1080"
    }
  }
}
```

**Response (Error)**
```json
{
  "version": "1.0",
  "message_type": "response",
  "timestamp": "2024-01-01T00:00:01Z",
  "message_id": "cmd_001",
  "payload": {
    "status": "error",
    "error": {
      "code": "invalid_config",
      "message": "Invalid VLESS configuration",
      "details": "Missing required parameter: publicKey"
    }
  }
}
```

#### Disable VPN

Disables VPN connection.

**Request**
```json
{
  "version": "1.0",
  "message_type": "command",
  "timestamp": "2024-01-01T00:00:00Z",
  "message_id": "cmd_002",
  "payload": {
    "command": "disable_vpn"
  }
}
```

**Response (Success)**
```json
{
  "version": "1.0",
  "message_type": "response",
  "timestamp": "2024-01-01T00:00:01Z",
  "message_id": "cmd_002",
  "payload": {
    "status": "success",
    "data": {
      "vpn_status": "disabled",
      "stopped_at": "2024-01-01T00:00:01Z"
    }
  }
}
```

#### Get Status

Retrieves current VPN status and statistics.

**Request**
```json
{
  "version": "1.0",
  "message_type": "command",
  "timestamp": "2024-01-01T00:00:00Z",
  "message_id": "cmd_003",
  "payload": {
    "command": "get_status"
  }
}
```

**Response**
```json
{
  "version": "1.0",
  "message_type": "response",
  "timestamp": "2024-01-01T00:00:01Z",
  "message_id": "cmd_003",
  "payload": {
    "status": "success",
    "data": {
      "vpn_status": "enabled",
      "mode": "selective",
      "connected_since": "2024-01-01T00:00:00Z",
      "uptime_seconds": 3600,
      "connection_info": {
        "server_address": "vpn.example.com",
        "server_port": 443,
        "protocol": "vless",
        "security": "reality"
      },
      "statistics": {
        "bytes_uploaded": 1048576,
        "bytes_downloaded": 5242880,
        "connections_active": 5,
        "connections_total": 150
      },
      "performance": {
        "latency_ms": 45,
        "throughput_mbps": 25.5
      }
    }
  }
}
```

#### Update Domain List

Updates the whitelist of domains to proxy through VPN.

**Request**
```json
{
  "version": "1.0",
  "message_type": "command",
  "timestamp": "2024-01-01T00:00:00Z",
  "message_id": "cmd_004",
  "payload": {
    "command": "update_domains",
    "domains": {
      "whitelist": [
        "example.com",
        "*.google.com",
        "api.twitter.com"
      ],
      "blacklist": [
        "malicious-site.com"
      ]
    },
    "mode": "selective"
  }
}
```

**Response**
```json
{
  "version": "1.0",
  "message_type": "response",
  "timestamp": "2024-01-01T00:00:01Z",
  "message_id": "cmd_004",
  "payload": {
    "status": "success",
    "data": {
      "domains_updated": 3,
      "mode": "selective"
    }
  }
}
```

#### Switch Mode

Switches VPN operation mode.

**Request**
```json
{
  "version": "1.0",
  "message_type": "command",
  "timestamp": "2024-01-01T00:00:00Z",
  "message_id": "cmd_005",
  "payload": {
    "command": "switch_mode",
    "mode": "global"
  }
}
```

**Response**
```json
{
  "version": "1.0",
  "message_type": "response",
  "timestamp": "2024-01-01T00:00:01Z",
  "message_id": "cmd_005",
  "payload": {
    "status": "success",
    "data": {
      "previous_mode": "selective",
      "current_mode": "global"
    }
  }
}
```

#### Import Configuration

Imports VLESS configuration from URL or file.

**Request**
```json
{
  "version": "1.0",
  "message_type": "command",
  "timestamp": "2024-01-01T00:00:00Z",
  "message_id": "cmd_006",
  "payload": {
    "command": "import_config",
    "config_source": {
      "type": "url",
      "data": "vless://uuid@address:port?..."
    }
  }
}
```

**Response**
```json
{
  "version": "1.0",
  "message_type": "response",
  "timestamp": "2024-01-01T00:00:01Z",
  "message_id": "cmd_006",
  "payload": {
    "status": "success",
    "data": {
      "config_id": "config_67890",
      "config_name": "WORK PC",
      "validated": true
    }
  }
}
```

#### Export Configuration

Exports current configuration.

**Request**
```json
{
  "version": "1.0",
  "message_type": "command",
  "timestamp": "2024-01-01T00:00:00Z",
  "message_id": "cmd_007",
  "payload": {
    "command": "export_config",
    "format": "url",
    "include_domains": true
  }
}
```

**Response**
```json
{
  "version": "1.0",
  "message_type": "response",
  "timestamp": "2024-01-01T00:00:01Z",
  "message_id": "cmd_007",
  "payload": {
    "status": "success",
    "data": {
      "config_url": "vless://uuid@address:port?...",
      "domains": ["example.com", "*.google.com"],
      "mode": "selective"
    }
  }
}
```

#### Get Logs

Retrieves log entries.

**Request**
```json
{
  "version": "1.0",
  "message_type": "command",
  "timestamp": "2024-01-01T00:00:00Z",
  "message_id": "cmd_008",
  "payload": {
    "command": "get_logs",
    "filter": {
      "level": "error",
      "limit": 100,
      "since": "2024-01-01T00:00:00Z"
    }
  }
}
```

**Response**
```json
{
  "version": "1.0",
  "message_type": "response",
  "timestamp": "2024-01-01T00:00:01Z",
  "message_id": "cmd_008",
  "payload": {
    "status": "success",
    "data": {
      "logs": [
        {
          "timestamp": "2024-01-01T00:00:00Z",
          "level": "error",
          "component": "vless_client",
          "message": "Connection timeout",
          "context": {
            "server": "vpn.example.com:443",
            "attempt": 3
          }
        }
      ],
      "total_count": 1
    }
  }
}
```

### Event Messages

#### Connection Status Changed

Sent when VPN connection status changes.

```json
{
  "version": "1.0",
  "message_type": "event",
  "timestamp": "2024-01-01T00:00:00Z",
  "message_id": "event_001",
  "payload": {
    "event_type": "connection_status_changed",
    "data": {
      "previous_status": "connecting",
      "current_status": "enabled",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  }
}
```

#### Error Occurred

Sent when an error occurs in the service.

```json
{
  "version": "1.0",
  "message_type": "event",
  "timestamp": "2024-01-01T00:00:00Z",
  "message_id": "event_002",
  "payload": {
    "event_type": "error_occurred",
    "data": {
      "error_code": "connection_failed",
      "error_message": "Failed to establish VLESS connection",
      "severity": "high",
      "recoverable": true,
      "context": {
        "attempt": 2,
        "next_retry": "2024-01-01T00:00:30Z"
      }
    }
  }
}
```

#### Statistics Update

Sent periodically with updated statistics.

```json
{
  "version": "1.0",
  "message_type": "event",
  "timestamp": "2024-01-01T00:01:00Z",
  "message_id": "event_003",
  "payload": {
    "event_type": "statistics_update",
    "data": {
      "period_seconds": 60,
      "statistics": {
        "bytes_uploaded": 524288,
        "bytes_downloaded": 2097152,
        "connections_active": 8,
        "connections_new": 15,
        "latency_avg_ms": 42
      }
    }
  }
}
```

## Chrome Extension APIs

### chrome.proxy API

#### Setting PAC Script

```javascript
chrome.proxy.settings.set({
  value: {
    mode: "pac_script",
    pacScript: {
      data: pacScriptContent
    }
  },
  scope: "regular"
}, function() {
  if (chrome.runtime.lastError) {
    console.error("Proxy setting error:", chrome.runtime.lastError);
  }
});
```

#### Getting Current Proxy Settings

```javascript
chrome.proxy.settings.get({
  incognito: false
}, function(config) {
  console.log("Current proxy config:", config);
});
```

#### Clearing Proxy Settings

```javascript
chrome.proxy.settings.clear({
  scope: "regular"
}, function() {
  if (chrome.runtime.lastError) {
    console.error("Proxy clear error:", chrome.runtime.lastError);
  }
});
```

### chrome.storage API

#### Storing Configuration

```javascript
chrome.storage.local.set({
  vlessConfig: {
    url: "vless://...",
    name: "WORK PC"
  },
  domainList: ["example.com", "*.google.com"],
  operationMode: "selective",
  isEnabled: true
}, function() {
  console.log("Configuration saved");
});
```

#### Retrieving Configuration

```javascript
chrome.storage.local.get([
  'vlessConfig',
  'domainList',
  'operationMode',
  'isEnabled'
], function(result) {
  console.log("Current configuration:", result);
});
```

#### Watching for Changes

```javascript
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'local') {
    for (let key in changes) {
      console.log('Storage changed:', key, changes[key].oldValue, '->', changes[key].newValue);
    }
  }
});
```

### chrome.runtime API

#### Native Messaging

```javascript
// Send message to native host
chrome.runtime.sendNativeMessage('com.browsvpn.host', {
  command: 'enable_vpn',
  config: {
    vless_url: "vless://...",
    mode: "selective"
  }
}, function(response) {
  if (chrome.runtime.lastError) {
    console.error("Native messaging error:", chrome.runtime.lastError);
  } else {
    console.log("Native response:", response);
  }
});
```

#### Listening for Native Messages

```javascript
chrome.runtime.onMessageNative.addListener(function(message) {
  console.log("Received native message:", message);
  // Handle message
});
```

## VLESS Configuration Format

### URL Format

```
vless://[uuid]@[address]:[port]?[parameters]#[name]
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | Yes | Transport type (tcp, grpc, ws) |
| encryption | string | Yes | Encryption method (none for Reality) |
| security | string | Yes | Security type (reality, tls) |
| serviceName | string | No | gRPC service name |
| authority | string | No | HTTP authority header |
| pbk | string | Yes (for Reality) | Reality public key |
| fp | string | No | TLS fingerprint (chrome, firefox, etc.) |
| sni | string | Yes (for TLS/Reality) | Server Name Indication |
| sid | string | Yes (for Reality) | Reality short ID |
| spx | string | No | Reality SPI X |

### Example Configuration

```
vless://550e8400-e29b-41d4-a716-446655440000@vpn.example.com:443?type=grpc&encryption=none&serviceName=vpn&security=reality&pbk=BASE64_PUBLIC_KEY&fp=chrome&sni=example.com&sid=abcd&spx=%2F#MyProfile
```

### Configuration Object (Internal)

```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "address": "vpn.example.com",
  "port": 443,
  "type": "grpc",
  "encryption": "none",
  "serviceName": "vpn",
  "authority": "",
  "security": "reality",
  "publicKey": "BASE64_PUBLIC_KEY",
  "fingerprint": "chrome",
  "sni": "example.com",
  "shortId": "abcd",
  "spix": "/",
  "name": "MyProfile"
}
```

## Error Codes

| Code | Description | Severity | Recoverable |
|------|-------------|----------|-------------|
| 1001 | Invalid configuration | High | No |
| 1002 | Connection timeout | Medium | Yes |
| 1003 | Authentication failed | High | No |
| 1004 | Network unreachable | Medium | Yes |
| 1005 | Server error | Medium | Yes |
| 1006 | Protocol error | High | No |
| 1007 | Configuration parse error | High | No |
| 1008 | Service unavailable | Medium | Yes |
| 2001 | Native messaging error | High | No |
| 2002 | Proxy API error | Medium | Yes |
| 2003 | Storage error | Low | Yes |
| 3001 | Invalid domain format | Low | No |
| 3002 | Domain list too large | Medium | No |

## Data Types

### DomainList

```typescript
interface DomainList {
  whitelist: string[];  // Domains to proxy through VPN
  blacklist: string[];  // Domains to exclude from VPN
}
```

### OperationMode

```typescript
type OperationMode = 'selective' | 'global' | 'disabled';
```

### VPNStatus

```typescript
type VPNStatus = 'disabled' | 'connecting' | 'enabled' | 'error';

interface VPNStatusData {
  status: VPNStatus;
  mode: OperationMode;
  connectedSince?: string;  // ISO8601 timestamp
  uptimeSeconds?: number;
  connectionInfo?: ConnectionInfo;
  statistics?: Statistics;
  performance?: Performance;
}
```

### ConnectionInfo

```typescript
interface ConnectionInfo {
  serverAddress: string;
  serverPort: number;
  protocol: string;
  security: string;
}
```

### Statistics

```typescript
interface Statistics {
  bytesUploaded: number;
  bytesDownloaded: number;
  connectionsActive: number;
  connectionsTotal: number;
}
```

### Performance

```typescript
interface Performance {
  latencyMs: number;
  throughputMbps: number;
}
```

### LogEntry

```typescript
interface LogEntry {
  timestamp: string;  // ISO8601
  level: 'debug' | 'info' | 'warning' | 'error';
  component: string;
  message: string;
  context?: Record<string, any>;
}
```

---

## Implementation Status (2026-05-22)

### Transport layer

| Компонент | Статус |
|-----------|--------|
| Chrome length-prefixed framing (4 byte LE + JSON) | ✅ `internal/messaging/host.go` |
| JSON host manifest + `allowed_origins` | ✅ `com.browsvpn.host.json` |
| Registry → path to manifest | ✅ `install.ps1` / `setup_registry.bat` |
| Caller origin fail-closed gate | ✅ v2.2.1 — `origin.go` deny if manifest missing/broken/empty/placeholder; `[a-p]{32}` only — [SECURITY.md](./SECURITY.md) |

### Commands

| Command | Extension client | Go handler | Xray wired |
|---------|------------------|------------|------------|
| `enable_vpn` | ✅ | ✅ | ✅ |
| `disable_vpn` | ✅ | ✅ | ✅ |
| `get_status` | ✅ | ✅ | ✅ |
| `preflight` | ✅ | ✅ | — |
| `health_check` | ✅ | ✅ | — |
| `get_logs` | ✅ | ✅ (redacted) | — |
| `find_free_port` | ✅ | ✅ | — |
| `update_domains` | — (PAC in extension) | — | — |
| `import_config` / `export_config` | ✅ (extension JSON) | — | — |

### Events

| Event | Status |
|-------|--------|
| `connection_status_changed` | ❌ Not implemented (poll/alarms) |
| `error_occurred` | ❌ Planned |
| `statistics_update` | ❌ Planned |

Routing mode enforced in **extension PAC**, not Go data plane.