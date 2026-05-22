# Brows VPN - Browser Extension with VLESS Integration

## Overview

Brows VPN - это браузерное расширение для Chromium-based браузеров на Windows 11, которое позволяет проксировать отдельные сайты через VPN канал с использованием протокола VLESS с Reality security.

## Key Features

- **Selective Site Proxying**: Возможность выбирать конкретные сайты для проксирования через VPN
- **Global VPN Mode**: Опция направления всего трафика через VPN
- **White/Black List Management**: Управление списками доменов
- **VLESS Reality Support**: Полная поддержка VLESS с Reality security и gRPC транспортом
- **Auto-reconnect**: Автоматическое переподключение при потерях связи
- **Logging System**: Детальное логирование подключений и ошибок
- **Import/Export**: Импорт и экспорт конфигураций и списков доменов
- **System Tray Integration**: Визуальное управление через иконку в трее
- **Browser Extension UI**: Удобный интерфейс расширения в браузере

## Architecture

### Components

1. **Browser Extension** (Chromium Extension)
   - Manifest V3
   - Popup interface with enable/disable functionality
   - Settings page with mode selection
   - Domain list management
   - Chrome Proxy API integration

2. **Local Proxy Service** (Windows Application)
   - VLESS client implementation (based on Xray-core)
   - Local SOCKS5 proxy server
   - System tray icon with controls
   - Native messaging integration with browser extension
   - Configuration management
   - Logging system

### Data Flow

```
User Request → Browser → Extension (PAC Script) → Local SOCKS5 Proxy → VLESS Client → VPN Server
```

## Technology Stack

### Browser Extension
- **Manifest V3** (Chrome Extension API)
- **TypeScript/JavaScript** (ES6+)
- **React** (UI components)
- **Chrome APIs**:
  - `chrome.proxy` (PAC script management)
  - `chrome.storage` (configuration persistence)
  - `chrome.runtime` (native messaging)
  - `chrome.tabs` (tab management)

### Local Proxy Service
- **Xray-core** (VLESS implementation)
- **Go** (wrapper application)
- **Native Messaging Protocol** (communication with extension)
- **Windows System Tray API** (GUI integration)

## VLESS Configuration Support

Проект поддерживает VLESS конфигурации в формате URL:
```
vless://uuid@address:port?type=grpc&encryption=none&serviceName=vpn&security=reality&pbk=publicKey&fp=chrome&sni=serverName&sid=sessionId&spx=%2F#name
```

### Supported Parameters
- `type`: grpc, tcp, ws
- `encryption`: none (recommended for Reality)
- `security`: reality, tls
- `serviceName`: gRPC service name
- `authority`: HTTP authority header
- `pbk`: Reality public key
- `fp`: TLS fingerprint (chrome, firefox, safari, etc.)
- `sni`: Server Name Indication
- `sid`: Reality short ID
- `spx`: Reality SPI X (additional parameter)

## Modes of Operation

### 1. Selective Mode (Default)
- Только сайты из белого списка идут через VPN
- Все остальные сайты идут напрямую
- PAC скрипт маршрутизирует на основе доменов

### 2. Global Mode
- Весь трафик направляется через VPN
- Белый список игнорируется
- Полное проксирование всех соединений

### 3. Disabled Mode
- VPN отключен
- Весь трафик идет напрямую
- Локальный прокси может быть остановлен

## Open Source Foundation

Проект основан на [Censor Tracker](https://github.com/censortracker) open-source проектах:
- **censortracker/censortracker** - Browser extension UI and functionality
- **censortracker/proxy** - Lightweight proxy client with Xray integration

### Modifications from Original
- Enhanced VLESS Reality support
- Improved white/black list management
- System tray integration for Windows
- Enhanced logging system
- Auto-reconnect functionality
- Import/Export capabilities
- Global VPN mode

## Installation & Usage

### Prerequisites
- Windows 11
- Chromium-based browser (Chrome, Edge, Brave, etc.)
- VLESS server configuration
- Administrative privileges (for system tray app)

### Installation Process
1. Install Browser Extension
2. Install Local Proxy Service
3. Configure VLESS connection
4. Set up domain lists
5. Enable extension

### Configuration
1. Import VLESS configuration URL
2. Select operation mode (Selective/Global)
3. Add domains to white list (for Selective mode)
4. Enable VPN connection
5. Monitor connection status

## Development Status

**Current Phase**: Planning and Architecture Design

**Next Steps**:
- Set up development environment
- Fork and modify Censor Tracker extension
- Develop local proxy service
- Integrate components
- Testing and optimization

## License

This is a personal project for private use only. Based on open-source Censor Tracker project (MIT License).

## Security Considerations

- VLESS configurations stored locally encrypted
- No data sent to external services (except VPN server)
- Native messaging secured by browser
- Local SOCKS5 proxy bound to localhost only
- Regular security updates for Xray-core

## Future Enhancements

- [ ] Multi-server support with load balancing
- [ ] Connection speed monitoring
- [ ] Traffic statistics and usage reports
- [ ] Advanced routing rules
- [ ] DNS over VPN support
- [ ] Split tunneling by application
- [ ] IPv6 support
- [ ] WebRTC leak protection
