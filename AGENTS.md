# WEATHER TRACKER — SOL + LOCAL QWEN DEVELOPER LOOP PROTOKOLÜ v3

Repository:
`ertugrulcetinkaya-ai/weather_tracker`

Worker root:
`~/Tools/qwen-codex-worker`

## 1. ANA AMAÇ

Birincil optimizasyon hedefi:

**Codex / GPT-5.6 Sol kullanımını minimumda tutmak.**

Qwen token kullanımını minimuma indirmek ikincil hedeftir.

Tercih edilen geliştirme modeli:

`Sol specification`
→ `Local Qwen sandbox implementation`
→ `Local validation`
→ `Qwen repair loop`
→ `Local validation`
→ `Final candidate`
→ `Sol final semantic review`
→ gerekirse `targeted correction specification`
→ `Qwen repair`
→ `final validation`

Normal bir görevde hedef:

* 1 Sol planlama turu
* 0 Sol mechanical müdahalesi
* 1 Sol final review turu

Gerekirse yalnız exception/escalation durumunda ek Sol turu açılır.

---

# 2. ROLLER

## GPT-5.6 Sol — Tech Lead / Final Reviewer

Sol'un görevleri:

* kullanıcı isteğini anlamak
* repository'nin gerekli kısmını incelemek
* root-cause analizi
* architecture kararı
* implementation specification hazırlamak
* acceptance criteria tanımlamak
* güvenlik ve scope sınırlarını belirlemek
* final candidate diff'i semantic olarak incelemek
* gerekiyorsa correction specification hazırlamak
* final commit-readiness kararı vermek

Sol normal durumda:

* tek tek import düzeltmez
* JSX wiring yapmaz
* küçük TypeScript hatalarını çözmez
* her Qwen denemesini izlemez
* her test hatasında devreye girmez
* unified diff bookkeeping yapmaz

Sol bir **exception handler ve final reviewer** olarak kullanılmalıdır.

---

## Local Qwen — Sandbox Developer

Qwen artık yalnız unified diff üretmek zorunda değildir.

Qwen:

* disposable Git worktree içinde dosya okuyabilir
* allowed files üzerinde doğrudan edit yapabilir
* implementation gerçekleştirebilir
* validation sonucu kendisine verilince hatayı düzeltebilir
* aynı görev üzerinde birden fazla repair iteration yapabilir

Qwen:

* gerçek kullanıcı worktree'sine yazamaz
* gerçek checkpoint'i değiştiremez
* commit yapamaz
* push yapamaz
* dependency değiştiremez, açık izin olmadıkça
* allowed scope dışına çıkamaz
* secrets/env dosyalarını okuyamaz veya dışarı gönderemez

---

# 3. GERÇEK REPOSITORY VE SANDBOX AYRIMI

Ana repository çalışma alanı korunmalıdır.

Örnek:

`/Users/.../weather_tracker`

Bu alan:

**READ-ONLY FOR QWEN**

Qwen implementation için disposable Git worktree oluşturulur.

Örnek:

`/tmp/qwen-agent/weather-tracker/WT-001/`

veya güvenli kalıcı worker alanı:

`~/Tools/qwen-codex-worker/worktrees/WT-001/`

Qwen yalnız bu sandbox/worktree üzerinde değişiklik yapabilir.

Ana repo'daki:

* dirty worktree
* kullanıcı değişiklikleri
* checkpoint
* uncommitted work

doğrudan Qwen tarafından değiştirilemez.

---

# 4. WORKTREE OLUŞTURMA

Her implementation task için local orchestrator:

1. mevcut güvenli checkpoint'i tespit eder
2. task-specific disposable worktree oluşturur
3. gerekli mevcut uncommitted değişiklikler varsa güvenli şekilde sandbox'a taşır veya checkpoint snapshot oluşturur
4. Qwen'ı yalnız sandbox path ile sınırlar

Amaç:

Qwen başarısız olsa bile gerçek çalışma alanı hiçbir zaman bozulmamalıdır.

Task sonunda sandbox:

* kabul edilirse final diff kaynağı olur
* reddedilirse tamamen silinebilir

---

# 5. QWEN ARTIK UNIFIED DIFF ÜRETMEK ZORUNDA DEĞİL

Eski kural:

`Qwen yalnız unified diff üretir.`

KALDIRILDI.

Yeni kural:

**Qwen sandbox içinde gerçek dosya editleri yapar.**

Final diff:

Qwen tarafından yazılmaz.

Git tarafından deterministik olarak üretilir:

`git diff`

Böylece aşağıdaki model hataları mimariden çıkar:

* yanlış hunk counts
* missing diff headers
* malformed hunks
* terminal newline diff serialization sorunları
* context mismatch kaynaklı apply failure

Diff serialization bir LLM görevi değildir.

---

# 6. SOL INITIAL SPECIFICATION

Sol görevin başında tek detaylı specification üretir.

Her spec şunları içermelidir:

## TASK

Tam olarak ne yapılacak?

## GOAL

Kullanıcı açısından beklenen sonuç nedir?

## ALLOWED FILES

Qwen hangi dosyaları değiştirebilir?

## READ CONTEXT

Hangi dosyaları yalnız okuyabilir?

## FORBIDDEN FILES

Örneğin:

* `.env`
* secrets
* credentials
* lockfiles
* CI
* unrelated backend/mobile files

## CONSTRAINTS

Korunması gereken behavior ve architecture.

## ACCEPTANCE CRITERIA

Task'ın başarılı sayılması için ölçülebilir şartlar.

## VALIDATION COMMANDS

Local orchestrator hangi komutları çalıştıracak?

## ESCALATION CONDITIONS

Hangi durumda Qwen artık devam etmemeli ve Sol'a dönülmeli?

---

# 7. ÖRNEK SPEC

Örneğin LocationControls wiring:

TASK:
`LocationControls.tsx` componentini `App.tsx` içine bağla.

GOAL:
Mevcut inline location/search/favorites presentation JSX'i component ile değiştir.

ALLOWED FILES:

* `mobile/App.tsx`
* gerekirse `mobile/src/components/LocationControls.tsx`

CONSTRAINTS:

* hooks App.tsx'te kalmalı
* hydration logic değişmemeli
* persistence behavior değişmemeli
* favorite chip:

  * height 44
  * minWidth 110
  * flexShrink 0
* favorite text lineHeight 20
* UI redesign yok
* dependency değişikliği yok

ACCEPTANCE:

* TypeScript geçmeli
* LocationControls App.tsx içinde kullanılmalı
* eski inline JSX kaldırılmış olmalı
* duplicate presentation kalmamalı
* critical style contract korunmalı

VALIDATION:

`cd mobile && npm run typecheck`
`git diff --check`

---

# 8. LOCAL QWEN IMPLEMENTATION LOOP

Sol specification verdikten sonra normal implementation döngüsüne karışmaz.

Local orchestrator:

1. Qwen'a specification verir
2. Qwen sandbox içinde edit yapar
3. validator çalışır
4. başarısızsa hata çıktısı Qwen'a geri verilir
5. Qwen mevcut sandbox state üzerinden düzeltir
6. yeniden validation çalışır
7. acceptance criteria sağlanana kadar sınırlı repair loop sürer

Akış:

`IMPLEMENT`
→ `VALIDATE`
→ PASS → `READY_FOR_FINAL_REVIEW`

veya:

`IMPLEMENT`
→ `VALIDATE`
→ FAIL
→ `QWEN REPAIR`
→ `VALIDATE`
→ ...

---

# 9. QWEN REPAIR PROMPT

Validation başarısızsa Sol'a dönme.

Local orchestrator Qwen'a şuna benzer bilgi verir:

`Original task specification`

`Current validation failure`

`Relevant command output`

`Current modified files`

`Do not restart implementation. Inspect your current sandbox changes and fix only the causes preventing acceptance criteria from passing.`

Qwen mevcut değişikliklerini iteratif olarak düzeltir.

Her seferinde sıfırdan yeni patch üretmesi gerekmez.

---

# 10. QWEN'A OTOMATİK GERİ VERİLECEK HATALAR

Aşağıdaki sorunlarda Sol devreye girmez:

* TypeScript compile error
* missing import
* unused import
* JSX syntax error
* prop mismatch
* lint error
* formatting problem
* test assertion failure
* test fixture error
* straightforward runtime validation failure
* file path mistake
* forgotten callback wiring
* missing mock
* deterministic API/type mismatch

Bunlar local developer repair loop ile çözülmelidir.

---

# 11. SOL'A ESCALATE EDİLECEK DURUMLAR

Qwen aşağıdaki durumlarda durmalı:

### Architecture belirsizliği

Görevi tamamlamak için mevcut architecture değişmek zorunda görünüyorsa.

### Scope expansion

Allowed files dışında meaningful değişiklik gerekiyorsa.

### Repeated failure

Aynı temel validation problemi örneğin 3 kez tekrarlandıysa.

### Test vs implementation ambiguity

Test mi yanlış, implementation mı yanlış ayırt etmek için semantic karar gerekiyorsa.

### Destructive risk

Data loss, migration, security veya credential riski varsa.

### Dependency requirement

Yeni dependency eklemek gerçekten gerekli görünüyorsa.

### Large refactor emergence

Başlangıçta mechanical görünen görev geniş architecture refactor'a dönüşüyorsa.

### Acceptance contradiction

Sol tarafından verilen acceptance criteria kendi içinde çelişkili görünüyorsa.

---

# 12. REPAIR LIMIT

Varsayılan:

**maksimum 3 automatic repair iteration**

Aynı task için.

Ancak farklı ve açıkça ilerleme gösteren basit compile/test hatalarında orchestrator 4. iteration'a izin verebilir.

Kör tekrar yasaktır.

Şu davranış yasak:

`aynı prompt → aynı failure → tekrar aynı prompt`

Her retry yeni failure evidence içermelidir.

---

# 13. LOCAL VALIDATION SEVİYELERİ

Her task için en ucuz gerekli validation önce çalıştırılır.

## Level 1 — Structural

* allowed files
* forbidden file check
* dependency guard
* `git diff --check`

## Level 2 — Targeted compile/lint

Örneğin:

`npm run typecheck`

veya targeted Ruff.

## Level 3 — Targeted tests

Yalnız ilgili component/test/module.

## Level 4 — Milestone full suite

Birden fazla task tamamlanınca.

## Level 5 — Final regression

Final Sol review öncesi veya sonrası.

Her Qwen editinden sonra full suite çalıştırmak varsayılan değildir.

---

# 14. QWEN'IN TOOL YETKİLERİ

Qwen sandbox içinde minimum şu yeteneklere sahip olabilir:

* read file
* edit/write allowed file
* list relevant files
* grep/search
* run approved validation commands

Komut yürütme allow-list ile sınırlandırılmalıdır.

Qwen'a arbitrary shell verilmek zorunda değildir.

Önerilen allowed command tipleri:

* git diff
* git status
* TypeScript typecheck
* Jest targeted test
* pytest targeted test
* Ruff
* formatting/lint tools

Şunlar varsayılan olarak yasak:

* git commit
* git push
* destructive git reset
* rm outside sandbox
* curl/arbitrary network
* package install
* credential access

---

# 15. NETWORK / LOCAL QWEN ENDPOINT

Local Qwen endpoint is supplied by the developer's local worker configuration
and must not be stored in the repository.

Repository source içeriği yalnız bu onaylı yerel worker endpoint'ine ve task için gerekli scope kadar gönderilebilir.

Gönderilmemesi gerekenler:

* `.env`
* API keys
* tokens
* credentials
* passwords
* unrelated private files

Mümkün olduğunda relevant excerpts tercih edilir.

Ancak sandbox-agent çalışması için gerektiğinde allowed source files tam olarak kullanılabilir.

Başka endpoint'e kaynak kod gönderme izni yoktur.

---

# 16. QWEN MECHANICAL MODE

Mevcut validated ayarlar korunur:

* `enable_thinking=false`
* reasoning chars hedefi: 0
* temperature: 0.7
* top_p: 0.8
* top_k: 20
* presence_penalty: 1.5

Unified-diff output limiti artık ana bottleneck olmadığından output cap task türüne göre kullanılabilir.

Qwen'ın uzun reasoning üretmesine izin verilmez.

Semantic architecture reasoning Sol'a aittir.

---

# 17. WORKER VALIDATION

Qwen'ın textual response'u artık final artifact değildir.

Ana artifact sandbox filesystem state'idir.

Bu nedenle worker başarısı:

`model response parse edildi mi?`

ile değil:

`expected filesystem changes oluştu mu ve validation geçti mi?`

ile ölçülür.

Qwen "DONE" dese bile validation başarısızsa task başarısızdır.

Qwen "başarısız oldum" dese bile dosya state'i kabul kriterlerini sağlıyorsa local validator gerçek durumu esas alabilir.

---

# 18. FINAL CANDIDATE PACKAGE

Local Qwen loop başarılı olduğunda Sol'a bütün geçmiş gönderilmez.

Sol'a yalnız compact final candidate verilir:

## Original Task

Kısa specification.

## Final Changed Files

Liste.

## Git Diff

Git tarafından üretilmiş final diff.

## Validation

Örneğin:

* typecheck PASS
* targeted tests 18/18 PASS
* diff check PASS

## Repair Summary

Örneğin:

* iteration 1: missing prop
* iteration 2: unused import
* iteration 3: pass

## Scope Report

* dependency changed: no
* forbidden files touched: no
* outside allowed scope: no

## Qwen Telemetry

Aggregate:

* calls
* repair iterations
* completion tokens
* reasoning chars
* elapsed time

Ara Qwen transcript'leri Sol context'ine taşınmaz.

---

# 19. SOL FINAL SEMANTIC REVIEW

Sol yalnız final candidate üzerinde şunları kontrol eder:

* kullanıcı isteği gerçekten karşılanıyor mu
* behavior korunmuş mu
* architecture doğru mu
* scope creep var mı
* hidden regression riski var mı
* testlerin kaçırdığı semantic hata var mı
* unnecessary complexity var mı
* security/gizlilik riski var mı

Sol mechanical format kontrolüyle vakit harcamamalıdır.

---

# 20. SOL REVIEW SONUÇLARI

Sol şu kararlardan birini verir:

## ACCEPT

Candidate ana çalışma alanına taşınabilir.

## ACCEPT WITH SMALL SOL CORRECTION

Gerçekten çok küçük ve deterministik bir problem varsa Sol doğrudan düzeltme yapabilir.

Bu istisna için Qwen'a tekrar dönmek zorunlu değildir.

## RETURN TO QWEN

Semantic düzeltme gerekiyorsa Sol yeni bir focused correction specification üretir.

Sonra tekrar local Qwen repair loop çalışır.

## REJECT / REDESIGN

Architecture yanlışsa candidate atılır ve yeni spec oluşturulur.

---

# 21. ANA REPOSITORY'YE AKTARMA

Sol candidate'ı kabul ettikten sonra sandbox değişiklikleri güvenli şekilde gerçek worktree'ye taşınır.

Aktarım yöntemi deterministik olmalıdır.

Örneğin:

* Git patch/cherry-pick benzeri güvenli transfer
* kontrollü file copy
* worktree diff apply

Ana repository'ye transfer sırasında mevcut kullanıcı değişiklikleri overwrite edilmez.

Transfer öncesi:

* checkpoint karşılaştır
* conflict check
* diff check

yapılır.

---

# 22. FINAL REGRESSION

Task ana repo'ya aktarıldıktan sonra mantıklı milestone'da full validation yapılır.

Weather Tracker için finalde:

Mobile:

`npm run check`

Backend:

`ruff check app tests`
`python -m pytest`

Her küçük task sonrası bunların tamamı tekrar çalıştırılmaz.

---

# 23. WEATHER TRACKER REGRESSION CONTRACTS

Özellikle korunacaklar:

## Favorite chip

* `height: 44`
* `minWidth: 110`
* `flexShrink: 0`
* text `lineHeight: 20`

## Fractional humidity

Mevcut fractional humidity fix kaldırılmamalıdır.

## Hydration

`useLocationPreferences` mevcut hydration safeguards korunmalıdır.

## Dependencies

Açık görev olmadan dependency upgrade yapılmaz.

---

# 24. CODEX LIMIT OPTİMİZASYONU

Her adımda şu soru sorulur:

`Bu failure Qwen + local validator tarafından Sol'a dönmeden çözülebilir mi?`

Cevap evetse Sol çağrılmaz.

Sol'a yalnız:

* ilk specification
* escalation
* final semantic review

için dönülür.

Hedef normal bir task için:

**2 Sol interaction**

1. Plan/specification
2. Final review

---

# 25. QWEN TELEMETRY

Her task için aggregate ölç:

* total Qwen calls
* implementation calls
* repair calls
* total completion tokens
* reasoning chars
* validation failures
* final pass iteration
* elapsed time
* Sol escalation count

Özellikle ölçülecek KPI:

**Sol interactions per completed task**

Bu yeni protokolün ana verimlilik metriğidir.

---

# 26. KÖR RETRY YASAĞI

Bir task sürekli başarısızsa Qwen'a tekrar tekrar aynı şey sorulmaz.

Her retry:

* mevcut filesystem state
* spesifik validation error
* unchanged constraints

ile yapılır.

Yeni evidence yoksa retry yok.

---

# 27. ARA RAPOR POLİTİKASI

Her Qwen repair iteration kullanıcıya veya Sol'a raporlanmaz.

Yalnız:

* meaningful escalation
* task complete
* final validation failure
* güvenlik problemi

durumlarında ara rapor oluşturulur.

Bu hem kullanıcı deneyimini hem Codex context tüketimini azaltır.

---

# 28. DEFAULT TASK FLOW

Normal görev:

### A. Sol

Inspect minimum necessary context.

### B. Sol

Specification + acceptance criteria üret.

### C. Local Orchestrator

Disposable worktree oluştur.

### D. Qwen

Implementation yap.

### E. Local Validator

Targeted validation çalıştır.

### F. Qwen

Gerekirse automatic repair.

### G. Local Validator

Acceptance criteria tamamlanana kadar tekrar et.

### H. Local Orchestrator

Final candidate package oluştur.

### I. Sol

Bir kez semantic final review yap.

### J. Local Orchestrator

Accepted candidate'ı ana repo'ya güvenli aktar.

### K. Milestone Validation

Uygun full test/regression çalıştır.

---

# 29. ESCALATION FLOW

Qwen 3 repair sonunda hâlâ başarısızsa:

Sol'a yalnız:

* original spec
* final/current diff
* failing validation
* üç attempt'ın kısa özeti

gönderilir.

Sol bütün Qwen transcript'lerini okumaz.

Sol:

* root cause belirler
* specification'ı düzeltir
* gerekirse scope'u değiştirir

ve Qwen loop tekrar başlar.

---

# 30. SOL DIRECT EDIT FALLBACK

Sol doğrudan edit yapabilir ancak bu istisnadır.

Uygun durumlar:

* 1–5 satırlık deterministik düzeltme
* Qwen'ın aynı mechanical noktada birkaç kez başarısız olması
* Qwen'a yeniden dönmenin Codex tasarrufuna katkı sağlamaması
* semantic karar zaten verilmiş olması

Bu durumda Sol'un küçük edit yapması protokol ihlali değildir.

Ama substantial implementation tekrar Sol'a taşınmamalıdır.

---

# 31. FINAL REPORT

Final rapor kısa olmalıdır.

* task
* changed files
* Qwen implementation calls
* repair iterations
* Sol interaction count
* total local Qwen completion tokens
* reasoning chars
* validation results
* final regression
* diff stat
* remaining risks

Son karar:

`READY FOR COMMIT`

veya

`NOT READY FOR COMMIT — <reason>`

Kullanıcı açıkça istemedikçe:

NO COMMIT
NO PUSH

---

# 32. ANA PRENSİP

Yeni protokolün özü:

**Sol düşünür ve yön verir.
Qwen sandbox içinde işi yapar ve kendi hatalarını düzeltir.
Local tools doğrular.
Sol yalnız sonuçla ilgilenir.**

Codex limit tasarrufu için Qwen ile Sol arasındaki geçiş sayısı mümkün olan minimumda tutulmalıdır.
