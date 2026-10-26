# Исследование публичных репозиториев kort0881
Дата: 26.10.2026. Исследованы список репозиториев аккаунта, деревья выбранных проектов и ключевые файлы. Это не аудит всех строк всех репозиториев.

- internet-access-site: витрина, загрузка subscriptions_list.txt и Telegram-прокси, Flask и статическая сборка. Собственного VPN-туннеля нет. https://github.com/kort0881/internet-access-site
- vpn-checker-backend: агрегация, дедупликация, проверка доступности и формирование списков. В исследованной функции проверки main.py используются TCP/TLS/WS; открытый порт не доказывает работоспособность ключа. В workflow скачивается Xray, что само по себе не доказывает его использование в проверке. MPL-2.0. https://github.com/kort0881/vpn-checker-backend
- sbornik-vless: разбиение по протоколам и публикация. worker.js возвращает env.TOKEN как текст, не создаёт прокси. MIT. https://github.com/kort0881/sbornik-vless/blob/main/worker.js
- vpn-vless-configs-russia: источники, зеркалирование, генераторы. scripts/generate_cf_vless.py создаёт случайные UUID для IP Cloudflare; соответствующая серверная конфигурация не создаётся. Такой подход не использован. GPL-3.0. https://github.com/kort0881/vpn-vless-configs-russia/blob/main/scripts/generate_cf_vless.py
- vpn-aggregator: модули загрузки, разбора и фильтрации, отчёты. Лицензия не указана в метаданных API при исследовании. https://github.com/kort0881/vpn-aggregator
- paid-keys-fetcher: скачивает подписку из секрета PAID_URL, а не создаёт независимый VPN. https://github.com/kort0881/paid-keys-fetcher
- vpn-private-poster: контент и Telegram-публикации, не найден готовый сервер каскада в изученной структуре. https://github.com/kort0881/vpn-private-poster

В исследованных файлах не найдено развёртывание серверной части именно той персональной подписки, которую прислал пользователь. Клиентские настройки не раскрывают серверный маршрут. Ссылка подписки и UUID пользователя в проект не включены.

Исполняемая реализация написана отдельно. Список внешних источников адаптирован из vpn-checker-backend под MPL-2.0; см. THIRD-PARTY.md и upstream-sources.json. Ссылки сохранены для сверки выводов. Наличие открытого кода сборщика не означает наличие серверов, выдающих чужие ключи.
