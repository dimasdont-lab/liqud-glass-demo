# Voice Finance Native — повна специфікація для нового Xcode-проєкту

## Як використовувати цей документ

Це готове технічне завдання для нового чату Codex на Mac. Передай новому чату цей файл і посилання на чинний прототип:

- Web-прототип: https://dimasdont-lab.github.io/voice-finance-free/
- Репозиторій прототипу: https://github.com/dimasdont-lab/voice-finance-free

Новий застосунок треба створити **з нуля як нативний SwiftUI-проєкт у Xcode**. Не загортати поточний сайт у WKWebView і не переносити HTML/CSS як основу інтерфейсу. Прототип є функціональним та візуальним референсом.

## Головна мета

Створити приватний фінансовий застосунок для iPhone, iPad, Apple Watch і, за можливості, Mac, із вебдоступом на ПК. Дані користувача мають синхронізуватися через його Apple Account та бути доступними офлайн. Основний спосіб швидкого введення — текстова або голосова фраза українською, польською, англійською чи їх сумішшю.

Обов’язкові принципи:

- нативний SwiftUI, не WebView;
- локальна/offline-first робота;
- жодних платних AI/STT API або оплати за хвилини розпізнавання;
- аудіо не відправляється стороннім AI-сервісам;
- ручне введення працює незалежно від голосу та мережі;
- усі зміни даних мають стабільні UUID, часові мітки й безпечне злиття між пристроями;
- дизайн повинен легко змінюватися централізовано протягом усього життя продукту.

## Платформи й targets

Створити один Xcode workspace/project із такими targets:

1. `VoiceFinance` — iOS/iPadOS SwiftUI app.
2. `VoiceFinanceWatch` — незалежний watchOS SwiftUI app із companion-зв’язком.
3. `VoiceFinanceWidgets` — WidgetKit для iPhone/iPad.
4. `VoiceFinanceWatchWidgets` — complications/widgets для Watch.
5. `VoiceFinanceTests` — unit tests.
6. `VoiceFinanceUITests` — UI tests.

Якщо ресурсу достатньо, увімкнути Mac Catalyst або окремий macOS target на спільних feature-модулях.

Рекомендований deployment target: iOS/iPadOS 26 і watchOS 26 для повного Liquid Glass та нового Speech framework. Якщо потрібна підтримка iOS 18/19, зробити `if #available` і material-based fallback, не дублюючи екрани.

## Архітектура проєкту

Використати feature-first modular architecture без надмірного фреймворкового шару:

```text
VoiceFinance/
  App/
  Core/
    DesignSystem/
    Models/
    Persistence/
    Sync/
    Speech/
    Parsing/
    ReceiptScanning/
    Navigation/
    Utilities/
  Features/
    Home/
    Analytics/
    Transactions/
    Debts/
    QuickEntry/
    Profile/
  SharedUI/
VoiceFinanceWatch/
  Home/
  QuickEntry/
  Debts/
  Connectivity/
Widgets/
Tests/
```

Правила залежностей:

- View не звертається безпосередньо до CloudKit, Speech або файлової системи.
- Feature використовує протоколи repository/service через dependency container.
- Бізнес-правила, parser і синхронізація не залежать від SwiftUI.
- Уся навігація типізована (`NavigationStack`, enum routes).
- Async робота через Swift Concurrency; UI-моделі ізольовані `@MainActor`.
- Не створювати один гігантський ObservableObject.

## Design System і Liquid Glass

Усі кнопки, док, sheet-картки, popover, фільтри та інтерактивні панелі мають використовувати Liquid Glass.

Для iOS 26:

- `glassEffect(_:in:)` для власних карток;
- `.buttonStyle(.glass)` та `.buttonStyle(.glassProminent)`;
- `GlassEffectContainer` для нижнього доку й груп кнопок;
- `.interactive()` для елементів, які реагують на дотик;
- `glassEffectID` і `glassEffectTransition` лише для зрозумілих morph-переходів;
- не створювати зайві GlassEffectContainer: це шкодить продуктивності.

Fallback для старіших iOS: `.ultraThinMaterial`, stroke, shadow і ті самі design tokens.

У `Core/DesignSystem` створити:

- `AppTheme` / `ThemeProvider` через Environment;
- semantic colors: background, surface, textPrimary, textSecondary, accent, income, expense;
- spacing scale;
- typography roles;
- corner-radius tokens;
- icon sizes;
- animation tokens;
- glass styles;
- reusable `GlassButton`, `GlassCard`, `GlassSheet`, `MetricCard`, `ListRow`, `BottomDock`.

Жодного випадкового hardcode кольорів, відступів, шрифтів чи радіусів у feature views. Заміна теми або редизайн повинні виконуватися переважно через DesignSystem, а не редагування кожного екрана.

Підтримати Dynamic Type, Reduce Motion, VoiceOver, достатній contrast і hit area не менше 44×44 pt.

## Навігація й поточний інтерфейс

### Нижній док

Композиція зліва направо:

1. Аналітика.
2. Scan.
3. Центральний великий червоний `+` — швидке введення фразою/голосом.
4. Борги.
5. Home.

Ліва й права пара розміщені в окремих Liquid Glass capsules. Центральний плюс — prominent circular Liquid Glass control із червоним tint і білим кільцем.

Profile — окрема кругла Liquid Glass-кнопка у верхньому лівому куті.

### Home

- загальний баланс;
- компактний зелений графік праворуч;
- доходи й витрати як окремі активні зони, що відкривають відповідну аналітику;
- сума кожної метрики має власну обмежену зону й автоматично зменшує шрифт, якщо не поміщається;
- категорії компактним списком: іконка, назва, сума;
- останні операції;
- фінансовий контроль: місячний ліміт і накопичення.

### Аналітика

- чистий результат;
- витрати по категоріях;
- доходи по клієнтах;
- зведення по боргах: мої борги, мої боржники, чиста позиція, термінові та оплачені;
- періоди: тиждень, місяць, рік, довільний діапазон;
- усі обчислення коректні для валют, без складання різних валют в одну суму без FX-курсу.

### Борги

- верхні віджети `Мої борги` та `Мої боржники` активні й відкривають відповідний повний список;
- три нейтральні Liquid Glass accordion-панелі з іконками: `Мої борги`, `Мої боржники`, `Термінові`;
- лічильник кожної групи вирівняний праворуч;
- всередині поруч: `Не оплачено` та `Оплачено`;
- сортування за іменем/назвою А→Я і Я→А;
- окремої кнопки `Додати борг` немає — борги додаються центральним плюсом;
- оплата боржником створює пов’язаний дохід;
- оплата власного боргу створює пов’язану витрату;
- повторне редагування не створює дубль;
- скасування оплати або видалення пов’язаної операції повертає борг у неоплачений стан.

### Quick Entry

Після натискання `+`:

- активується поле та клавіатура;
- картка тримається над клавіатурою;
- користувач може надрукувати або продиктувати фразу;
- показується live transcript;
- результат завжди проходить через confirmation/edit card;
- маленькі круглі icon-buttons: розібрати, змінити, зберегти;
- усі sheets можна закрити свайпом вниз за будь-яку неінтерактивну область;
- знак `+` на початку — дохід, `-`, `−`, `–`, `—` — витрата і має найвищий пріоритет.

## Модель даних

Не використовувати `Double` для грошей. Зберігати `amountMinor: Int64` і ISO currency code.

### Transaction

- `id: UUID`
- `ownerRecordName: String`
- `type: income | expense`
- `amountMinor: Int64`
- `currencyCode: String`
- `categoryID: UUID`
- `clientOrMerchant: String?`
- `note: String?`
- `source: manual | typedPhrase | voice | receipt | debtSettlement | watch`
- `linkedDebtID: UUID?`
- `occurredAt`, `createdAt`, `updatedAt`
- `deviceID`, `revision`
- `isDeleted`, `deletedAt`

### Debt

- `id: UUID`
- `direction: owed | receivable`
- `personName`
- `amountMinor`, `currencyCode`
- `note`, `dueDate?`, `isUrgent`, `isPaid`
- `settlementTransactionID?`
- audit/sync fields як у Transaction.

Також: `Category`, `MonthlyBudget`, `UserPreferences`, `SyncMetadata`.

Видалення синхронізувати через tombstone, а не фізично видаляти одразу. Конфлікти: більший revision, потім `updatedAt`; settlement-зв’язки мають перевірку інваріантів.

## Голосове введення — безкоштовне й локальне

### Рекомендована стратегія

Основний engine для змішаних UA + PL + EN фраз — **WhisperKit** через Swift Package Manager, мультимовна модель. Причина: Apple legacy `SFSpeechRecognizer` створюється для однієї locale, тому не є надійним для code-switching в одному реченні.

Режими моделі:

- сучасний iPhone із достатньою пам’яттю: рекомендована WhisperKit multilingual `large-v3` 626 MB для максимальної точності;
- середній пристрій: multilingual `small` або `base`;
- debug/старий пристрій: multilingual `tiny`, але не вважати його production-quality.

Модель завантажується один раз лише за явною дією користувача, показує розмір і прогрес, кешується локально та може бути видалена в Profile.

Другий engine/fallback на iOS 26 — Apple `SpeechAnalyzer` + `SpeechTranscriber`. Він локальний і не надсилає аудіо на сервери Apple. Використати його як швидкий системний режим для підтримуваної locale або коли Whisper-модель не встановлена.

Legacy fallback — `SFSpeechRecognizer` тільки після перевірки `supportsOnDeviceRecognition`; `requiresOnDeviceRecognition = true`. Не використовувати мережеве розпізнавання для фінансових фраз без явного окремого opt-in.

### Audio pipeline

- `AVAudioSession` category `.record`/`.playAndRecord` відповідно до UX;
- `AVAudioEngine` tap або рекомендований capture provider;
- state machine: idle → requestingPermission → recording → stopping → transcribing → confirmation → error;
- завжди знімати tap, зупиняти engine й деактивувати session на success/error/cancel;
- VAD/автостоп після тиші;
- ліміт запису;
- переривання дзвінком, route change, background/foreground;
- п’ять і більше послідовних записів без перезапуску;
- не зберігати аудіо після підтвердження, якщо користувач не ввімкнув debug.

### Parser

Parser залишається локальним і детермінованим. Підтримати цифри та number words UA/PL/EN, валюти PLN/EUR/USD/GBP, бренди, категорії, клієнтів і борги.

Обов’язкові fixtures:

- `+1300 Johnny` → income 1300 PLN, client Johnny;
- `-200 на продукти` → expense 200 PLN, groceries;
- `200 злотих Biedronka`;
- `Бєдронка, продукти, двісті злотих`;
- `мінус 45 злотих Uber`;
- `плюс 3000 злотих від Johnny за зйомку`;
- `Johnny заплатив мені 2000 за монтаж`;
- `50 євро hotel Booking`;
- `dwieście złotych Biedronka`;
- `Lidl sto pięćdziesiąt złotych`;
- `two hundred PLN Uber`;
- `я винен Олегу 500`;
- `Марек винен мені 300 PLN`;
- `мені винна Анна 200`;
- `борг мені Johnny 100 євро терміново`.

Невпевнений результат не зберігати автоматично.

## Receipt Scan

Нативно й без платного API:

- камера/фото/PDF import;
- VisionKit document scanner;
- Vision `VNRecognizeTextRequest` для OCR;
- languages UA/PL/EN, accurate recognition, language correction;
- локальний parser шукає total, currency, date, merchant і line items;
- confirmation/edit обов’язковий;
- оригінал чека локально за вибором користувача; для CloudKit image asset — тільки explicit setting.

## Синхронізація акаунта й усіх пристроїв

### Джерело істини

Використати **CloudKit private database** користувача. На Apple-платформах — SwiftData/Core Data local store + CloudKit sync. Увімкнути iCloud/CloudKit і Background Modes → Remote notifications.

Важливо: iCloud capability потребує активного Apple Developer account. Це не платний runtime API за кожен запит, але для підпису/дистрибуції застосунку потрібна участь у Apple Developer Program.

### Web/PC

Щоб дані були доступні з Windows/іншого ПК, створити або адаптувати web client через **CloudKit JS**, який працює з тим самим CloudKit container і private database після входу Apple ID. Поточний GitHub Pages прототип можна перетворити на цей web client, але не зберігати CloudKit server private key у статичному frontend.

Вебверсія повинна:

- авторизувати користувача через підтримуваний CloudKit web auth / Apple account flow;
- читати й змінювати ті самі records;
- мати IndexedDB offline cache й outbox;
- не втрачати поточний typed parser/manual entry;
- не покладатися на браузерний голос як основний.

### Apple Watch

Watch app не є лише remote control. Він має локальний store/outbox і дозволяє:

- швидко додати дохід/витрату;
- продиктувати коротку фразу системним або локальним доступним engine;
- побачити баланс, сьогоднішні доходи/витрати;
- побачити термінові борги;
- позначити борг оплаченим;
- complication/widget із балансом або швидким `+` без показу чутливих сум за замовчуванням на Always-On display.

Синхронізація Watch:

- прямий CloudKit sync, коли є мережа та iCloud;
- `WCSession.sendMessage` для негайної дії, коли iPhone reachable;
- `transferUserInfo` для гарантованої черги змін у background;
- `updateApplicationContext` тільки для останнього snapshot UI;
- idempotency через UUID/revision — одна операція з Watch не може створитися двічі;
- тестувати на фізичних iPhone + Apple Watch, бо Simulator не підтримує всі background transfer сценарії.

## Міграція даних із web-прототипу

Додати імпорт JSON, який експортує поточна web-версія. Імпортер:

- показує preview;
- конвертує суми в minor units;
- зберігає UUID або створює deterministic migration IDs;
- не дублює повторний імпорт;
- створює debt settlement links;
- після імпорту показує reconciliation summary.

## Безпека і приватність

- private CloudKit database;
- Keychain для локальних секретів/ідентифікаторів;
- Privacy manifests і зрозумілі usage descriptions;
- microphone/speech/camera permission лише в момент першого використання;
- не логувати transcript, фінансові суми або CloudKit payload у production;
- optional Face ID lock;
- приховування сум у app switcher та Watch Always-On;
- export/delete all data;
- жодної сторонньої аналітики в першій версії.

## Обов’язкові тести

### Unit

- parser fixtures;
- signed amounts;
- minor-unit currency conversion;
- totals/categories/analytics;
- debt settlement invariants;
- conflict resolution, tombstones, idempotency;
- import migration;
- adaptive amount typography/layout logic.

### Integration

- offline create/edit/delete → reconnect → CloudKit sync;
- зміна на iPhone з’являється на iPad/Mac/web;
- зміна на web з’являється на iPhone;
- Watch offline operation доставляється рівно один раз;
- одночасне редагування боргу на двох пристроях;
- account unavailable, iCloud disabled, quota/error recovery.

### Voice

- реальні записи UA, PL, EN і code-switching;
- шумне середовище;
- п’ять послідовних циклів;
- permission denied/re-enabled;
- interrupted audio session;
- model missing/download interrupted/low storage;
- порівняльний benchmark SpeechAnalyzer vs WhisperKit на однаковому корпусі: word error rate, правильність суми/валюти/типу, latency, peak memory, battery impact.

### UI

- iPhone SE/mini/Pro Max/iPad;
- великі суми не перекривають графік чи сусідні метрики;
- Dynamic Type XXXL;
- VoiceOver order/labels;
- keyboard avoidance;
- swipe-to-dismiss;
- Reduce Motion;
- Liquid Glass readability на світлому й темному контенті.

## Послідовність реалізації

1. Створити Xcode targets, DesignSystem, models і локальний SwiftData store.
2. Реалізувати manual CRUD, Home, Аналітику, Борги й parser без хмари.
3. Додати CloudKit schema/sync, offline outbox і conflict tests.
4. Додати JSON migration з web-прототипу.
5. Додати SpeechAnalyzer prototype та WhisperKit benchmark на реальному iPhone.
6. Обрати production model за вимірюваннями, а не припущеннями.
7. Додати receipt OCR.
8. Додати watchOS app, WatchConnectivity і complications.
9. Підключити CloudKit JS web client для ПК.
10. Пройти accessibility, sync, performance і physical-device QA.

## Definition of Done

- це нативний SwiftUI застосунок, а не web wrapper;
- усі поточні фінансові й боргові сценарії працюють;
- Liquid Glass використаний системно через DesignSystem;
- дизайн змінюється централізовано;
- голос реально протестований на змішаних UA/PL/EN фразах;
- немає платного STT/AI runtime;
- iPhone, iPad, Watch і web/PC бачать узгоджені дані одного користувача;
- offline changes не губляться й не дублюються;
- є імпорт поточних web-даних;
- є unit, integration та UI tests;
- README містить точні кроки Xcode signing, CloudKit schema, model download і запуску всіх targets.

## Перше повідомлення для нового чату

> Відкрий `IOS_NATIVE_HANDOFF.md` і виконай його як специфікацію. Створи в Xcode нативний SwiftUI-застосунок Voice Finance з нуля — не WKWebView. Працюй end-to-end: архітектура, локальні моделі, UI/DesignSystem з Liquid Glass, parser, локальний мультимовний voice pipeline, CloudKit sync, watchOS app, WatchConnectivity, тести й документація. Спочатку перевір доступні версії Xcode/iOS SDK та реальні пристрої, потім починай реалізацію. Не використовуй платні AI/STT API. Не зупиняйся на плані: збирай і тестуй кожний milestone.
