// Builds docs/week05/Hafta05_ML-Agents_Rapor.docx from the results in docs/week05/data.
//   NODE_PATH=<folder containing node_modules/docx> node tools/report/build_report.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, ExternalHyperlink, TableOfContents, PageBreak, Footer, PageNumber,
  LevelFormat,
} = require("docx");

const ROOT = path.resolve(__dirname, "..", "..");
const DOCS = path.join(ROOT, "docs", "week05");
const IMG = path.join(DOCS, "images");
// The student number is passed at build time (STUDENT_NO=...) so it never ends up in the public repository.
const STUDENT_NO = process.env.STUDENT_NO || "……………………";
const REPO_URL = "https://github.com/Veyselugurlu/BLM5026-Bilgisayar-Oyunlarinda-Yapay-Zeka";
const BRANCH_URL = REPO_URL + "/tree/feature/week05-ml-agents";

const summary = JSON.parse(fs.readFileSync(path.join(DOCS, "data", "results_summary.json"), "utf8"));
const training = JSON.parse(fs.readFileSync(path.join(DOCS, "data", "training_summary.json"), "utf8"));
const evalDir = path.join(DOCS, "data", "eval");
const evalRun = (n) => JSON.parse(fs.readFileSync(path.join(evalDir, n + ".json"), "utf8"));

const BLUE = "1F4E79", ACCENT = "2A6FDB", GREY = "F2F4F7", INK = "222222";
const PAGE_W = 9026; // A4 width minus 2 x 1440 margins (DXA)

// ------------------------------------------------------------------ helpers
const t = (text, o = {}) => new TextRun({ text, ...o });
const P = (runs, o = {}) => new Paragraph({ children: Array.isArray(runs) ? runs : [t(runs)], spacing: { after: 120, line: 300 }, ...o });
const H1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t(text)], pageBreakBefore: true });
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [t(text)] });
const H3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [t(text)] });
const B = (text) => t(text, { bold: true });
const I = (text) => t(text, { italics: true });
const C = (text) => t(text, { font: "Consolas", size: 19, color: "8A2B06" });
const bullet = (runs) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: Array.isArray(runs) ? runs : [t(runs)], spacing: { after: 60, line: 288 } });
const numIn = (instance) => (runs) => new Paragraph({ numbering: { reference: "numbers", level: 0, instance }, children: Array.isArray(runs) ? runs : [t(runs)], spacing: { after: 60, line: 288 } });
const num = numIn(1), num2 = numIn(2), num3 = numIn(3);
const link = (text, url) => new ExternalHyperlink({ link: url, children: [t(text, { style: "Hyperlink" })] });
const pct = (v) => (v * 100).toFixed(1);
const pm = (m) => (m.std > 0 ? `${pct(m.mean)} ± ${pct(m.std)}` : pct(m.mean));

function code(lines) {
  return lines.map((line, i) => new Paragraph({
    children: [t(line === "" ? " " : line, { font: "Consolas", size: 18 })],
    shading: { type: ShadingType.CLEAR, fill: "F5F5F5", color: "auto" },
    spacing: { after: i === lines.length - 1 ? 160 : 0, line: 240 },
    indent: { left: 200, right: 200 },
  }));
}

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

let figNo = 0;
const figIds = {};
function figure(file, caption, widthPx = 600, id = null, numbered = true) {
  if (numbered) { figNo += 1; if (id) figIds[id] = figNo; caption = `Şekil ${figNo}. ${caption}`; }
  const full = path.join(IMG, file);
  const { w, h } = pngSize(full);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 },
      children: [new ImageRun({ type: "png", data: fs.readFileSync(full), transformation: { width: widthPx, height: Math.round(widthPx * h / w) },
        altText: { title: caption, description: caption, name: file } })],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [t(caption, { italics: true, size: 19, color: "555555" })] }),
  ];
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "BFC5CD" };
const borders = { top: border, bottom: border, left: border, right: border };
function table(headers, rows, widths, caption) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (text, w, head, bold) => new TableCell({
    borders, width: { size: w, type: WidthType.DXA },
    shading: head ? { fill: "DCE6F2", type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ children: [t(String(text), { bold: head || bold, size: 19 })] })],
  });
  const out = [new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i], true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => { const o = typeof c === "object" && c !== null; return cell(o ? c.text : c, widths[i], false, o && c.bold); }) }))],
  })];
  if (caption) out.push(new Paragraph({ spacing: { before: 60, after: 200 }, children: [t(caption, { italics: true, size: 19, color: "555555" })] }));
  return out;
}

function note(runs) {
  return new Paragraph({
    children: Array.isArray(runs) ? runs : [t(runs)],
    shading: { type: ShadingType.CLEAR, fill: "EAF2FB", color: "auto" },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: ACCENT, space: 8 } },
    spacing: { before: 120, after: 200, line: 288 }, indent: { left: 200, right: 200 },
  });
}

// ------------------------------------------------------------------ data
const fixed = summary.Fixed, rnd = summary.Random;
const names = {
  random: "Rastgele politika (eğitimsiz)", scripted: "Kural tabanlı kontrolcü",
  ppo_Absolute8: "PPO baseline (8 gözlem)", ppo_NoVelocity6: "PPO Deney A (6, hızsız)", ppo_Relative5: "PPO Deney B (5, göreli)",
};
const order = ["random", "scripted", "ppo_Absolute8", "ppo_NoVelocity6", "ppo_Relative5"];
const evalRows = (S) => order.map((k) => [
  names[k], pm(S[k].success_rate), pct(S[k].fall_rate.mean), pct(S[k].timeout_rate.mean),
  S[k].mean_episode_length.mean.toFixed(1), S[k].mean_time_to_target_s.mean.toFixed(2),
]);
const seedVals = (mode, spawn) => [1, 2, 3].map((s) => pct(evalRun(`ppo_${mode}_s${s}_${spawn}`).success_rate));
const to90 = (mode) => [1, 2, 3].map((s) => {
  const v = training[mode][`RB_${mode}_s${s}`].steps_to_90pct_success;
  return v ? `${v / 1000}k` : "ulaşmadı";
});
const finalSucc = (mode) => [1, 2, 3].map((s) => pct(training[mode][`RB_${mode}_s${s}`]["RollerBall/Success Rate"].final));

// ------------------------------------------------------------------ content
const cover = [
  new Paragraph({ spacing: { before: 1200, after: 120 }, alignment: AlignmentType.CENTER, children: [t("BURSA TEKNİK ÜNİVERSİTESİ", { bold: true, size: 28, color: BLUE })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [t("Lisansüstü Eğitim Enstitüsü · Bilgisayar Mühendisliği Yüksek Lisans", { size: 22 })] }),
  new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER, children: [t("BLM5026 Bilgisayar Oyunlarında Yapay Zeka", { size: 26, color: "444444" })] }),
  new Paragraph({ spacing: { before: 300, after: 120 }, alignment: AlignmentType.CENTER, children: [t("Rapor 4 (Hafta 5)", { bold: true, size: 44, color: BLUE })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [t("Unity ML-Agents ile Pekiştirmeli Öğrenme:", { bold: true, size: 32 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [t("Kurulum, Basic Örneği ve Kendi RollerAgent Ortamımız", { bold: true, size: 32 })] }),
  ...figure("scene_perspective.png", "RollerAgent ortamı: yeşil top (ajan) turuncu küpe (hedef) ulaşmayı öğreniyor", 430, null, false),
  new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.CENTER, children: [B("Öğrenci: "), t("Veysel Uğurlu")] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [B("Öğrenci No: "), t(STUDENT_NO)] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [B("Dersi Veren: "), t("Doç. Dr. İzzet Fatih Şentürk")] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [B("Tarih: "), t("Ekim 2026")] }),
  new Paragraph({ spacing: { before: 300 }, alignment: AlignmentType.CENTER, children: [B("GitHub deposu: "), link(REPO_URL, REPO_URL)] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [t("Bu haftanın dalı: ", { size: 20 }), link("feature/week05-ml-agents", BRANCH_URL)] }),
];

const toc = [
  new Paragraph({ pageBreakBefore: true, children: [t("İçindekiler", { bold: true, size: 32, color: BLUE })], spacing: { after: 200 } }),
  new TableOfContents("İçindekiler", { hyperlink: true, headingStyleRange: "1-2" }),
];

const ozet = [
  H1("Özet"),
  P("Bu raporda (Rapor 4) dersin 5. haftasında işlenen Unity ML-Agents konusunun uygulaması anlatılmaktadır. Amaç, bir oyun karakterine bir görevi kurallarını tek tek kodlamadan, deneme yanılma yoluyla (pekiştirmeli öğrenme) öğretmektir."),
  P("İlk aşamada (Sunu 1) ML-Agents 4.1.0 kaynak koddan kurulmuş, sürüm uyumu doğrulanmış ve resmi Basic örneği PPO algoritmasıyla eğitilmiştir. Basic ajanı yaklaşık 12.000 adımda teorik olarak en iyi ödül olan 0.93'e ulaşmıştır."),
  P([t("İkinci aşamada (Sunu 2) RollerAgent ortamı sıfırdan kurulmuştur: yeşil bir küre, turuncu bir küpe ulaşmayı öğrenir. Eğitilen model aynı 200 başlangıç koşulunda test edilmiştir. Eğitimsiz rastgele politika %"), t(pct(fixed.random.success_rate.mean)),
    t(" başarı gösterirken, eğitilmiş PPO politikası 3 farklı seed üzerinden ortalama %"), B(pm(fixed.ppo_Absolute8.success_rate)), t(" başarıya ulaşmıştır. En iyi seed %100 başarıya ulaşmıştır.")]),
  P([t("Sunudaki challenge kapsamında bir gözlem ablasyonu yapılmıştır. Gözlemden hız bilgisinin çıkarılması (Deney A) bu görevde başarıyı düşürmemiştir. Mutlak konumlar yerine hedefe göreli konum verilmesi (Deney B) ise ajanın eğitimde hiç görmediği başlangıç noktalarındaki başarısını %"),
    B(pct(rnd.ppo_Absolute8.success_rate.mean)), t("'den %"), B(pct(rnd.ppo_Relative5.success_rate.mean)), t("'e çıkarmıştır.")]),
  P([B("Anahtar kelimeler: "), t("Unity ML-Agents, pekiştirmeli öğrenme, PPO, ödül tasarımı, gözlem tasarımı, genelleme, ONNX inference")]),
];

const giris = [
  H1("1. Giriş"),
  H2("1.1 Bu haftanın amacı"),
  P("Hafta 5'te iki sunu işlenmiştir. Bu raporda her ikisinin adımları uygulanmış ve sonuçlar ölçülmüştür:"),
  bullet([B("Sunu 1, Kurulum ve hazır ortam: "), t("ML-Agents'ın sürüm uyumlu kurulumu (advanced installation), Basic örneğinin PPO ile eğitilmesi ve modelin Unity'de çalıştırılması (inference).")]),
  bullet([B("Sunu 2, Kendi ortamımız (RollerAgent): "), t("Gözlem, aksiyon ve ödül tasarımı, klavye ile test (heuristic), PPO eğitimi, inference, karşılaştırmalı değerlendirme ve gözlem ablasyonu.")]),
  H2("1.2 Pekiştirmeli öğrenme nedir? (kısa anlatım)"),
  P("Klasik oyun yapay zekâsında (örneğin sonlu durum makineleri veya A*) karakterin ne yapacağını programcı kurallarla yazar. Pekiştirmeli öğrenmede ise programcı yalnızca neyin iyi olduğunu söyler (ödül), nasıl yapılacağını ajan kendisi bulur. Ajan bir ortamda hareket eder, her adımda ortamı gözlemler, bir aksiyon seçer ve zaman zaman ödül alır. Binlerce denemeden sonra ödülü artıran davranışları daha sık seçmeyi öğrenir."),
  ...table(["Kavram", "Anlamı", "RollerBall'daki karşılığı"], [
    ["Ajan (Agent)", "Karar veren taraf", "Yeşil top"],
    ["Ortam (Environment)", "Ajanın içinde bulunduğu dünya", "Zemin, hedef, fizik motoru"],
    ["Gözlem (Observation)", "Ajanın her adımda aldığı bilgi", "8 sayı: hedef konumu, ajan konumu, hız"],
    ["Aksiyon (Action)", "Ajanın her adımda verdiği karar", "2 sayı: X ve Z yönünde kuvvet (−1..+1)"],
    ["Ödül (Reward)", "Davranışın ne kadar iyi olduğunu gösteren sayı", "Hedefe ulaşınca +1"],
    ["Episode", "Başlangıçtan bitişe bir deneme", "Başla → başar / düş / süre dolsun"],
    ["Politika (Policy)", "Gözlemi aksiyona çeviren fonksiyon (sinir ağı)", "Eğitilen şey"],
    ["PPO", "Politikayı küçük ve güvenli adımlarla güncelleyen algoritma", "mlagents-learn içinde"],
    ["Inference", "Eğitilmiş modelin sadece kullanılması", "ONNX dosyası Unity'de, Python olmadan"],
  ], [2000, 3626, 3400], "Tablo 1. Temel kavramlar"),
  H2("1.3 ML-Agents mimarisi"),
  P("ML-Agents iki parçadan oluşur. Unity tarafı deneyim üretir: sahne, fizik, ajanın gözlemleri ve ödülleri. Python tarafındaki mlagents-learn programı bu deneyimleri toplayıp PPO ile sinir ağını günceller. İki taraf bir ağ bağlantısı (gRPC) üzerinden haberleşir. Eğitim bitince sinir ağı bir .onnx dosyasına yazılır. Bu dosya Unity'deki Behavior Parameters bileşenine verildiğinde ajan artık Python olmadan çalışır."),
  ...figure("diagram_rl_loop.png", "Unity ile Python eğitim programı arasındaki öğrenme döngüsü"),
];

const kurulum = [
  H1("2. Kurulum (Sunu 1)"),
  H2("2.1 Sürüm politikası"),
  P("Sunudaki sürüm politikasına uyularak Unity paketi ve Python trainer aynı kaynak ağacından alınmıştır: Unity paketi 4.1.0'ın yayımlandığı repo revizyonu (commit ee0a08c)."),
  ...table(["Bileşen", "Sürüm", "Nasıl doğrulandı"], [
    ["Unity Editor", "6000.3.25f1 (Unity 6.3 LTS)", "ProjectSettings/ProjectVersion.txt"],
    ["Render pipeline / şablon", "URP 17.3, Universal 3D", "Packages/manifest.json"],
    ["Input System", "1.20.0", "Packages/manifest.json"],
    ["com.unity.ml-agents", "4.1.0", "package.json içindeki version alanı"],
    ["Kaynak commit", "ee0a08ccae59…", "git rev-parse HEAD"],
    ["Python", "3.10.12", "python --version"],
    ["mlagents / mlagents-envs", "1.2.0.dev0 (kaynaktan)", "pip list (tahmin edilmedi, okundu)"],
    ["PyTorch", "2.8.0 (CPU)", "pip list"],
    ["mlagents-learn --help", "OK", "Terminal çıktısı"],
  ], [2600, 2700, 3726], "Tablo 2. Ortam manifesti (Sunu 1, Aktivite 1)"),
  H2("2.2 Kurulum adımları"),
  num("Resmi depo klonlandı ve 4.1.0 kaynağına sabitlendi."),
  ...code(["git clone https://github.com/Unity-Technologies/ml-agents.git", "cd ml-agents", "git checkout ee0a08ccae597094003844d0121317f9790a1676", "# kontrol: com.unity.ml-agents/package.json -> \"version\": \"4.1.0\""]),
  num("Python 3.10.12 ortamı oluşturuldu. Conda yerine eşdeğer bir sanal ortam (uv + venv) kullanıldı; C: diskindeki yer sıkıntısı nedeniyle ortam D: diskine kuruldu."),
  num("Python paketleri sunudaki sırayla kuruldu. Önce envs kurulur, çünkü mlagents ona bağımlıdır; aksi halde PyPI'dan farklı bir envs sürümü inebilir."),
  ...code(["python -m pip install ./ml-agents-envs", "python -m pip install ./ml-agents", "mlagents-learn --help"]),
  num("Unity 6.3 projesi Universal 3D şablonuyla oluşturuldu ve ML-Agents 4.1.0 paketi eklendi."),
  note([B("Doğrulama: "), t("Projede paket, Unity Package Registry'den (4.1.0) yüklendi. Bu paketin Runtime/ klasörü, klonlanan kaynaktaki com.unity.ml-agents/Runtime ile diff aracıyla karşılaştırıldı. Satır sonu (CRLF/LF) dışında fark bulunmadı, yani Unity tarafı ile Python tarafı aynı revizyondan geliyor.")]),
  ...figure("editor/04_package_manager.png", "Unity Package Manager: projede ML Agents 4.1.0 (Unity Registry) yüklü"),
];

const basic = [
  H1("3. Hazır Ortam: Basic Örneği (Sunu 1)"),
  H2("3.1 Basic ortamı nedir?"),
  P("Basic, ML-Agents'ın en basit örneğidir. Ajan 0 ile 20 arasındaki bir doğru üzerinde 10. konumda başlar. Her adımda sola gidebilir, sağa gidebilir ya da durabilir (3 ayrık aksiyon). 7. konumda küçük bir hedef (+0.1), 17. konumda büyük bir hedef (+1) vardır. Her adım −0.01 ceza verir. Gözlem, ajanın konumunun 20 elemanlı one-hot kodlamasıdır."),
  P([t("Bu yüzden en iyi strateji hesaplanabilir: büyük hedefe 7 adımda gidilir ve "), B("1 − 7 × 0.01 = 0.93"), t(" ödül alınır. Küçük hedefe gitmek ise 0.1 − 3 × 0.01 = 0.07 ödül getirir. Eğitimin doğru çalışıp çalışmadığını bu teorik değerle kontrol edebiliriz.")]),
  H2("3.2 Eğitim ve teşhis (Aktivite 2)"),
  P("Basic sahnesi, klonlanan depodaki Project/ klasöründen standalone olarak build edildi ve sunudaki komutla eğitildi. Proje Unity 6000.0 ile hazırlanmıştı ve 6000.3'te otomatik olarak yükseltildi."),
  ...code(["mlagents-learn config/basic_short.yaml --run-id=Basic_U63_01 --env=Builds/Basic/Basic.exe --no-graphics"]),
  note([B("Not: "), t("Resmi config/ppo/Basic.yaml'da max_steps 500.000'dir. Ajan 12.000 adımda optimuma ulaşıp orada sabitlendiği için, yalnızca bu değer 40.000'e indirilerek config/basic_short.yaml oluşturuldu. Diğer tüm hiperparametreler aynıdır. Sunu da \"kısa süre eğitim başlatın\" demektedir.")]),
  P("Aktivitenin istediği üç kanıt:"),
  bullet([B("Bağlantı: "), C("Connected to Unity environment with package version 4.1.0 and communication version 1.5.0")]),
  bullet([B("Adım ilerlemesi: "), C("Step: 2000 … Mean Reward: 0.129"), t(" → "), C("Step: 12000 … Mean Reward: 0.925")]),
  bullet([B("Üretilen dosyalar: "), C("results/Basic_U63_01/"), t(" altında Basic.onnx, checkpoint.pt, TensorBoard event dosyası, configuration.yaml ve run_logs/")]),
  ...figure("basic_training_curve.png", "Basic ortamında ortalama ödül; yeşil kesikli çizgi teorik en iyi değer (0.93)"),
  P("Behavior Name eşleşmesi: Unity'deki Behavior Parameters → Behavior Name değeri \"Basic\", YAML'daki behaviors: anahtarı da \"Basic\". Bu ikisi eşleşmezse trainer \"behavior bulunamadı\" hatası verir."),
];

const agentCode = [
  "public override void OnEpisodeBegin()",
  "{",
  "    body.linearVelocity  = Vector3.zero;   // hareket durumunu da sıfırla",
  "    body.angularVelocity = Vector3.zero;",
  "    transform.localPosition = new Vector3(0f, 0.5f, 0f);",
  "    do { targetPos = RandomFloorPoint(); }               // hedef ajanın üstüne doğmasın",
  "    while (Vector3.Distance(targetPos, transform.localPosition) < successDistance + 0.5f);",
  "    target.localPosition = targetPos;",
  "}",
  "",
  "public override void CollectObservations(VectorSensor sensor)",
  "{",
  "    sensor.AddObservation(target.localPosition);     // 3",
  "    sensor.AddObservation(transform.localPosition);  // 3",
  "    sensor.AddObservation(body.linearVelocity.x);    // 1",
  "    sensor.AddObservation(body.linearVelocity.z);    // 1  -> toplam 8",
  "}",
  "",
  "public override void OnActionReceived(ActionBuffers actions)",
  "{",
  "    var a = actions.ContinuousActions;",
  "    Vector3 force = new Vector3(a[0], 0f, a[1]) * forceMultiplier;   // forceMultiplier = 10",
  "    body.AddForce(force, ForceMode.Force);",
  "    if (Vector3.Distance(transform.localPosition, target.localPosition) < 1.4f)",
  "    { SetReward(1f); EndEpisode(); }                 // başarı",
  "    else if (transform.localPosition.y < -1f)",
  "    { EndEpisode(); }                                // düştü",
  "}",
];

const roller = [
  H1("4. Kendi Ortamımız: RollerAgent (Sunu 2)"),
  H2("4.1 Problem tanımı (MDP)"),
  ...table(["Bileşen", "Tasarım"], [
    ["Durum / Gözlem", "Hedefin yerel konumu (3) + ajanın yerel konumu (3) + ajanın X, Z hızı (2) = 8 sayı"],
    ["Aksiyon", "2 sürekli değer (−1..+1): X ve Z yönünde uygulanacak kuvvetin yönü ve şiddeti"],
    ["Ödül", "Hedefe uzaklık < 1.4 ise +1 ve episode biter. Başka ödül veya ceza yok (sunudaki temel tasarım)"],
    ["Bitiş", "Başarı · zeminden düşme (y < −1) · Max Step = 500 adım (zaman aşımı)"],
    ["Rastgelelik", "Her episode'da hedef [−3.5, 3.5] × [−3.5, 3.5] alanında rastgele bir yere konur"],
  ], [2200, 6826], "Tablo 3. RollerAgent problemi"),
  H2("4.2 Sahne"),
  P("Tüm nesneler tek bir TrainingArea altında gruplandı. Bu sayede alan kopyalanarak paralel eğitim yapılabilir. Sahne, yazdığımız bir Editor scripti (RollerBallSceneBuilder.cs, menü: ML Agents Course → 1. Build RollerBall Training Scene) ile tek tıkla, her seferinde aynı şekilde üretilebilir."),
  ...code(["TrainingArea", " ├─ Floor        Plane 10x10, MeshCollider, mavi", " ├─ Target       Cube, turuncu, local (3, 0.5, 3), BoxCollider", " └─ RollerAgent  Sphere, yeşil, local (0, 0.5, 0)", "      Rigidbody · Behavior Parameters · Decision Requester · RollerBallAgent.cs"]),
  ...figure("scene_game_view.png", "Oyun kamerasından RollerBallTraining sahnesi", 470),
  P("Ajanı fizik motoruna Rigidbody bileşeni bağlar. Sunudaki kurala göre dinamik bir Rigidbody'yi her karede transform.position ile taşımak yerine ona kuvvet uygulanır; momentumu, sürtünmeyi ve düşmeyi fizik motoru hesaplar."),
  H2("4.3 Ajan kodu (RollerBallAgent.cs)"),
  P("Ajan sınıfı MonoBehaviour yerine ML-Agents'ın Agent sınıfından türetilir ve dört metodu doldurur. Kodun özü aşağıdadır; tamamı GitHub deposundadır."),
  ...code(agentCode),
  ...figure("diagram_episode_flow.png", "Bir episode boyunca çağrılan metotlar"),
  ...figure("diagram_observation_vector.png", "Ajanın her adımda gördüğü 8 sayılık gözlem vektörü"),
  P("Koddaki bazı tasarım kararları ve gerekçeleri:"),
  bullet([B("Hızları sıfırlamak: "), t("Sadece konumu sıfırlarsak, düşerken kazanılan hız yeni episode'a taşınır ve ajan daha başlarken kayar.")]),
  bullet([B("localPosition kullanmak: "), t("Gözlemler TrainingArea'nın koordinat sistemindedir. Alan dünyada başka bir yere kopyalansa da ajan aynı sayıları görür. World ve local karışırsa, kopyalanan alanlardaki ajanlar yanlış sayılar görür ve öğrenme bozulur.")]),
  bullet([B("Aksiyonu kuvvet olarak uygulamak: "), t("Aksiyon Rigidbody'ye bir itme kuvveti olarak verilir. Topun ne kadar hızlanacağını, Hafta 3'te işlenen F = m·a ilişkisine göre fizik motoru hesaplar.")]),
  bullet([B("Hedefin ajanın üstüne doğmaması: "), t("Aksi halde ajan hiçbir şey yapmadan ödül alır ve bu yanlış bir öğrenme sinyali olur.")]),
  bullet([B("Ek metrikler: "), t("Koda, TensorBoard'a başarı, düşme ve zaman aşımı oranlarını yazan satırlar eklendi (Academy.Instance.StatsRecorder). Ortalama ödül tek başına \"ne kadar sık düşüyor\" sorusunu cevaplamaz.")]),
  H2("4.4 Behavior Parameters ve Decision Requester"),
  ...table(["Ayar", "Değer", "Açıklama"], [
    ["Behavior Name", "RollerBall_U63", "YAML'daki behaviors anahtarıyla aynı olmalı"],
    ["Vector Observation Space Size", "8", "CollectObservations'ın ürettiği sayı adedi"],
    ["Continuous Actions", "2", "X ve Z kuvveti"],
    ["Discrete Branches", "0", "Ayrık aksiyon yok"],
    ["Behavior Type", "Default / Inference Only", "Eğitimde Default, modelle oynatırken Inference Only"],
    ["Decision Period", "1", "Her fizik adımında (0.02 s) karar"],
    ["Take Actions Between Decisions", "Açık", ""],
    ["Agent Max Step", "500", "500 adımda (10 s) hedefe varamazsa episode biter"],
  ], [3000, 2400, 3626], "Tablo 4. Behavior Parameters, C# ve YAML arasındaki sözleşme"),
  ...figure("editor/01_training_scene_inspector.png", "Unity Editor: RollerBallTraining sahnesi. Solda Hierarchy (TrainingArea → Floor, Target, RollerAgent), sağda RollerAgent'ın Rigidbody ve Behavior Parameters ayarları (Space Size 8, Continuous Actions 2)"),
  H2("4.5 Heuristic: eğitimden önce ortam testi"),
  P("\"RL öğrendi mi?\" sorusundan önce \"ortam doğru mu?\" sorusu cevaplanmalıdır. Heuristic metodu, yeni Input System'in Keyboard.current API'siyle WASD ve ok tuşlarını iki aksiyona çevirir; eski Input.GetAxis kullanılmamıştır. Behavior Type = Heuristic Only yapılınca top klavyeyle sürülebilir."),
  P([B("Manuel test sonucu (Aktivite 4): "), t("Unity Editor'da Behavior Type = Heuristic Only yapılarak top WASD ile sürüldü. Üç senaryo da beklendiği gibi çalıştı: (1) top tuşlarla hareket ediyor; (2) hedefe değince episode bitiyor, top merkeze dönüyor ve hedef yeni bir yere taşınıyor; (3) zeminden düşünce episode bitiyor ve top merkeze dönüyor.")]),
  ...figure("editor/02_heuristic_play.png", "Heuristic testi: Behavior Type = Heuristic Only, Play modunda top klavye ile sürülüyor"),
  P("Ortam mantığı ayrıca otomatik olarak da test edilmiştir. Hedefe doğru iten basit bir kural tabanlı kontrolcü 200 denemenin tamamında hedefe ulaşmıştır; bu, başarı kontrolünün ve episode sıfırlamanın çalıştığını gösterir. Rastgele hareket eden bir politika ise denemelerin çoğunda zeminden düşmüştür; bu da düşme kontrolünün ve sıfırlamanın çalıştığını gösterir."),
  H2("4.6 Eğitim"),
  P("Sunudaki PPO yapılandırması (config/rollerball_2026.yaml) hiç değiştirilmeden kullanıldı:"),
  ...table(["Hiperparametre", "Değer", "Ne işe yarar"], [
    ["batch_size / buffer_size", "128 / 2048", "Her güncellemede kullanılan örnek sayısı / toplanan deneyim"],
    ["learning_rate", "3.0e-4", "Ağ ağırlıklarının ne kadar hızlı değiştiği"],
    ["beta", "5.0e-3", "Keşfi teşvik eden entropi katsayısı"],
    ["epsilon", "0.2", "PPO'nun bir güncellemede politikayı ne kadar değiştirebileceği"],
    ["lambd / gamma", "0.95 / 0.99", "Avantaj tahmini (GAE) / gelecekteki ödüllerin indirimi"],
    ["num_epoch", "3", "Aynı veriden kaç kez öğrenileceği"],
    ["hidden_units × num_layers", "128 × 2", "Sinir ağının boyutu"],
    ["max_steps / time_horizon", "200000 / 64", "Toplam eğitim bütçesi / deneyim parçası uzunluğu"],
  ], [2800, 1800, 4426], "Tablo 5. PPO hiperparametreleri"),
  P("Eğitim, Unity Editor'da Play'e basmak yerine standalone build üzerinden yapıldı. Bu yöntem grafiksiz ve 20 kat hızlı çalıştığı için birden fazla seed'i makul sürede eğitmeyi mümkün kıldı:"),
  ...code(["mlagents-learn config/rollerball_2026.yaml --run-id=RB_Absolute8_s1 \\", "  --env=Builds/RollerBall/RollerBall.exe --no-graphics --seed=1 --time-scale=20 \\", "  --env-args -obsMode Absolute8 -areas 9"]),
  P("-areas 9 argümanı, yazdığımız TrainingAreaReplicator.cs scripti ile sahnedeki eğitim alanını 9 kopyaya çıkarır. Dokuz ajan aynı politikayı paylaşarak paralel deneyim toplar. Bu sadece duvar saati süresini kısaltır; toplam adım bütçesi (200.000) değişmez. Her eğitim CPU üzerinde 4 ile 13 dakika arasında sürdü."),
  H2("4.7 Inference: modeli Unity'de çalıştırmak"),
  num2("Eğitim sonunda results/<run-id>/RollerBall_U63.onnx dosyası üretilir."),
  num2("Dosya Assets/MLAgentsCourse/Models/ klasörüne kopyalanır."),
  num2("Behavior Parameters → Model alanına atanır, Behavior Type = Inference Only yapılır."),
  num2("Play'e basılır. Ajan artık Python olmadan, sadece Unity içindeki Inference Engine ile hareket eder."),
  P("Bu adımlar sonucunda iki sahne hazırlandı: RollerBallInference.unity (baseline modeli) ve RollerBallInference_Relative5.unity (Deney B modeli, ajan rastgele yerlerden başlar)."),
  ...figure("editor/03_inference_play.png", "Inference: Behavior Parameters → Model = RollerBall_U63 (eğitilmiş ONNX), Behavior Type = Inference Only; Play modunda ajan Python olmadan hareket ediyor"),
  ...figure("trained_agent_filmstrip.png", "Eğitilmiş ajan, 0.4 saniye aralıklarla. Her başarıdan sonra hedef yeni bir yere taşınıyor (3 s içinde 3 başarı)"),
];

const degerlendirme = [
  H1("5. Öğrenmeyi Nasıl Değerlendirdik?"),
  P("Sunu 2, öğrenme sürecinin çıktılarına bakmadan \"başarılı\" denmemesini ister ve bunun için bir deney düzeni önerir. Bu düzen şöyle uygulandı:"),
  bullet("Her yapılandırma 3 farklı rastgele tohumla (seed 1, 2, 3) baştan eğitildi."),
  bullet("Her eğitimin bütçesi 200.000 adımdı."),
  bullet("Her politika, Unity'ye aynı seed (12345) verilerek aynı 200 hedef konumunda test edildi; k. denemede her politika aynı hedefle karşılaştı."),
  bullet("Karşılaştırma için eğitimsiz rastgele bir politika (alt sınır) ve kural tabanlı bir kontrolcü kullanıldı. Kontrolcü topu hedefe doğru itiyor ve hızı kadar fren yapıyor; klavye heuristic'inin otomatik karşılığıdır."),
  bullet("Ölçülenler: başarı, düşme ve zaman aşımı oranları, ortalama episode uzunluğu ve hedefe ortalama varış süresi (1 adım = 0.02 s)."),
  P("Değerlendirme için tools/evaluate.py yazıldı. Bu script mlagents_envs Python API'si ile build'i çalıştırır ve ONNX modeli onnxruntime ile, eğitimdeki gibi rastgele örnekleme yapmadan, deterministik olarak çalıştırır."),
  ...table(["Politika", "Başarı %", "Düşme %", "Süre doldu %", "Ort. adım", "Varış (s)"], evalRows(fixed),
    [2900, 1350, 1150, 1300, 1150, 1176], "Tablo 6. Aynı 200 başlangıç koşulunda sonuçlar (ajan merkezden başlıyor, eğitimdeki gibi). PPO satırları: 3 seed ortalaması ± standart sapma"),
  ...figure("training_curves_all.png", "Eğitim boyunca metrikler (çizgi: 3 seed ortalaması, gölge: en düşük ile en yüksek seed arası)", 620, "curves"),
  H2("5.1 Baseline sonuçlarının yorumu"),
  bullet([t("Eğitilmiş PPO, rastgele politikaya göre başarıyı %"), t(pct(fixed.random.success_rate.mean)), t("'ten %"), t(pct(fixed.ppo_Absolute8.success_rate.mean)), t("'e çıkardı. Hedefe varış süresi yaklaşık 0.8 saniyeye indi. Bu süre, elle yazılmış kural tabanlı kontrolcüyle aynı düzeydedir.")]),
  bullet([t("Seed'lere göre başarı: %"), t(seedVals("Absolute8", "Fixed").join(" / %")), t(". Seed 2'nin eğitimi 200.000 adımda %"), t(finalSucc("Absolute8")[1]), t(" başarıda kaldı. Diğer iki seed %90'a sırasıyla "), t(to90("Absolute8")[0]), t(" ve "), t(to90("Absolute8")[2]), t(" adımda ulaştı.")]),
  note("Aynı kod ve ayarlarla yalnızca seed değiştiğinde başarı %80 ile %100 arasında değişti. Sunudaki \"tek run yeterli kanıt değildir\" uyarısı bu yüzden önemli; bu raporda PPO sonuçları 3 seed'in ortalaması ± standart sapması olarak verilmiştir."),
];

const ablasyon = [
  H1("6. Challenge: Gözlem Ablasyonu"),
  P("Sunu 2'nin son slaytı, gözlem setini değiştirerek bir hipotezi test etmeyi ister. Bunun için iki deney yapıldı. Kodda yalnızca CollectObservations ve Space Size değişti. Bunun için ajana bir ObservationMode ayarı eklendi; build'e komut satırından -obsMode argümanı verilerek seçilebiliyor."),
  ...table(["Deney", "Gözlem", "Boyut", "Hipotez"], [
    ["Baseline", "hedef konumu (3) + ajan konumu (3) + hız x, z (2)", "8", "(karşılaştırma tabanı)"],
    ["A", "hız çıkarıldı: hedef konumu (3) + ajan konumu (3)", "6", "Ajan fren yapamaz, hedefi geçer, daha yavaş ve daha kötü öğrenir"],
    ["B", "göreli konum: (hedef − ajan) (3) + hız x, z (2)", "5", "Davranış konumdan bağımsız olur, yeni başlangıç noktalarına daha iyi genelleşir"],
  ], [1100, 3500, 1000, 3426], "Tablo 7. Ablasyon deneyleri"),
  H2("6.1 Öğrenme hızı ve nihai başarı"),
  ...table(["Yapılandırma", "%90 başarıya ulaşılan adım (s1 / s2 / s3)", "Eğitim sonu başarı % (s1 / s2 / s3)"], [
    ["Baseline (8)", to90("Absolute8").join(" / "), finalSucc("Absolute8").join(" / ")],
    ["Deney A (6)", to90("NoVelocity6").join(" / "), finalSucc("NoVelocity6").join(" / ")],
    ["Deney B (5)", to90("Relative5").join(" / "), finalSucc("Relative5").join(" / ")],
  ], [2200, 3600, 3226], "Tablo 8. Eğitim eğrilerinden çıkarılan değerler (TensorBoard)"),
  H2("6.2 Genelleme testi: yeni başlangıç noktaları"),
  P("Deney B'nin sorusu, yeni başlangıç konumlarında genellemenin iyileşip iyileşmediğidir. Bunu ölçmek için ajan, eğitimde hiç olmadığı gibi, zeminin rastgele bir noktasından başlatıldı. Diğer her şey aynı kaldı: aynı modeller, aynı 200 hedef konumu."),
  ...table(["Politika", "Başarı %", "Düşme %", "Süre doldu %", "Ort. adım", "Varış (s)"], evalRows(rnd),
    [2900, 1350, 1150, 1300, 1150, 1176], "Tablo 9. Ajan rastgele yerden başladığında sonuçlar (genelleme testi)"),
  ...figure("eval_comparison.png", "Başarı ve düşme oranları. Solda eğitimdeki koşul, sağda genelleme testi", 620),
  ...figure("trained_agent_relative5_filmstrip.png", "Deney B modeli: ajan her episode'a farklı bir yerden başlıyor ve yine hedefe gidiyor"),
  ...figure("editor/05_console_relative5_play.png", "Deney B sahnesi Unity Editor'da çalışırken: Space Size 5, Model = RollerBall_U63_Relative5. Console'da hata ve uyarı yok (yalnızca bilgi mesajları)"),
  H2("6.3 Yorum"),
  P([B("Deney A (hız yok): "), t("Hipotez doğrulanmadı. Hız çıkarıldığında başarı düşmedi ve 3 seed de %100'e ulaştı. Ajan her 0.02 saniyede yeniden karar verdiği için, kendi hareketinin sonucunu bir sonraki gözlemde görüp düzeltebiliyor. Görev hedefte durmayı değil yalnızca dokunmayı istediğinden fren de gerekmiyor. Ancak politika entropisi tüm eğitim boyunca belirgin şekilde yüksek kaldı (Şekil " + figIds.curves + "). Yani ajan, aynı başarıya daha belirsiz kararlarla ulaşıyor. Hedefte durmayı gerektiren bir görevde hız bilgisinin önemi artacaktır.")]),
  P([B("Deney B (göreli konum): "), t("Hipotez güçlü biçimde doğrulandı. Merkezden başlarken üç yapılandırma da benzer. Ancak ajan rastgele yerden başladığında baseline %"), t(pct(rnd.ppo_Absolute8.success_rate.mean)), t(", Deney B ise %"), B(pct(rnd.ppo_Relative5.success_rate.mean)), t(" başarı gösterdi (seed'ler: %"), t(seedVals("Relative5", "Random").join(" / %")), t("). Mutlak konumla eğitilen ajan hep merkezden başladığı için yalnızca \"merkezden hedefe giden\" durumları görmüştür; başka bir yerden başladığında ezberlediği durumların dışına çıkar. Göreli gözlemde \"hedef 2 m sağımda\" durumu zeminin neresinde olursa olsun aynı sayılarla ifade edilir. Öğrenilen davranış böylece her yere taşınabilir (öteleme değişmezliği).")]),
  P([B("Bedeli: "), t("Göreli gözlem ajanın zemin kenarını bilmesini engeller. Deney B'de kalan %"), t(pct(rnd.ppo_Relative5.fall_rate.mean)), t("'lük düşmenin bu eksiklikten kaynaklandığı düşünülmektedir; bu ayrıca test edilmemiştir. Çözüm önerisi olarak göreli konuma \"kenarlara uzaklık\" gibi bir bilgi eklenebilir.")]),
];

const tartisma = [
  H1("7. Tartışma: Sunudaki Sorulara Cevaplar"),
  H3("Bu ortamda hangi gözlemler gerçekten öğrenme için gerekli?"),
  P("Ablasyon sonuçlarına göre hız bu görev için zorunlu değil (Deney A). Mutlak konumlar ise genellemeye zarar veriyor (Deney B). En kompakt ve en iyi genelleyen gözlem, hedefe göreli konum ile hızdır (5 sayı). Baseline'daki y koordinatları (hedef.y, ajan.y) neredeyse sabittir; bilgi taşımazlar."),
  H3("Neden konumları aynı koordinat sisteminde vermeliyiz? Local ve world karışırsa ne olur?"),
  P("Ajan iki konumu karşılaştırarak yön bulur. Biri world, diğeri local koordinattaysa aradaki fark anlamsızlaşır. TrainingArea orijindeyken sorun görünmez, ancak alan kopyalandığında (bizim 9 paralel alanımızda olduğu gibi) diğer alanlardaki ajanlar tutarsız sayılar görür ve öğrenme bozulur."),
  H3("Reward hacking: ajan platformdan düşerse ceza vermek şart mı?"),
  P("Bu ortamda şart değil. Düşmek episode'u ödülsüz bitirdiği için zaten ödülden vazgeçmek demektir. Eğitimin ilk 10.000 adımında episode'ların %50 ile %94'ü düşmeyle bitiyordu. Eğitim sonunda bu oran 9 eğitimin 8'inde %0.4'ün altına indi; yalnızca baseline seed 2'de %24'te kaldı (Şekil " + figIds.curves + "). Düşmeye büyük bir ceza vermek, ajanın kenardan aşırı kaçmasına ve hedef kenardayken çekingen davranmasına yol açabilir. Küçük bir adım cezası ise hızlı gitmeyi teşvik eder; ajan kodunda bu seçenek (stepPenalty) eklendi ancak sunudaki temel tasarıma sadık kalmak için 0 bırakıldı."),
  H3("MaxStep neden gerekir?"),
  P("MaxStep olmasaydı, hiçbir şey yapmayan ya da hedefin etrafında dönen bir ajan sonsuza kadar aynı episode'da kalabilirdi. Eğitim yeni hedef konumları görmez ve öğrenme takılırdı. Eğitimin ilk 10.000 adımında episode'ların en fazla %6'sı (rastgele politikada %9.5'i) zaman aşımıyla bitiyordu; eğitim sonunda bu oran tüm eğitimlerde %0'a indi."),
  H3("Bu gözlem vektörü öteleme ve dönme genellemesi açısından ideal mi?"),
  P("Öteleme açısından değil; Deney B bunu sayısal olarak gösterdi. Dönme açısından ise ajan dünya eksenlerinde kuvvet uyguladığı için TrainingArea döndürülürse gözlemler ve aksiyonlar uyumsuz hale gelir. Bu durumda gözlemlerin de aksiyonların da alanın yerel eksenlerine dönüştürülmesi gerekir."),
];

const sorunlar = [
  H1("8. Karşılaşılan Sorunlar ve Çözümler"),
  ...table(["Sorun", "Neden", "Çözüm"], [
    ["Unity build \"compiler errors\" ile durdu (GetLastError 1455)", "RAM yetersiz. Windows sayfa dosyası büyüyüp C: diskini doldurdu", "Gereksiz uygulamalar kapatıldı, C:'de yer açıldı, Unity işlemleri sırayla çalıştırıldı"],
    ["\"No valid Unity Editor license found\"", "Unity Hub oturumunun süresi dolmuştu", "Unity Hub'da Personal lisans yenilendi"],
    ["Basic örnek projesi 6000.0 sürümünde", "Depo Unity 6.0 ile hazırlanmış", "Unity 6000.3 açılışta otomatik yükseltti; build sorunsuz"],
    ["conda kurulu değildi", "Makinede Python 3.10 da yoktu", "Aynı Python 3.10.12 sürümüyle uv + venv kullanıldı (eşdeğer izolasyon)"],
    ["Basic eğitimi 500k adım sürecekti", "Resmi YAML uzun bütçe veriyor", "Optimum 12k adımda yakalandığı için max_steps 40k yapıldı (diğer ayarlar aynı)"],
  ], [3000, 2800, 3226], "Tablo 10. Karşılaşılan sorunlar"),
];

const sonuc = [
  H1("9. Sonuç"),
  P("Bu haftada ML-Agents'ın tüm iş akışı uçtan uca uygulanmıştır: sürüm uyumlu kurulum, hazır bir ortamın eğitilmesi, sıfırdan bir RL ortamı tasarlanması, PPO ile eğitim, ONNX modelinin Unity'de çalıştırılması ve öğrenmenin ölçülmesi."),
  bullet([t("PPO, kuralları hiç yazılmamış bir görevi 200.000 adımda öğrenmiş; başarı %"), t(pct(fixed.random.success_rate.mean)), t(" (rastgele) seviyesinden %"), t(pct(fixed.ppo_Absolute8.success_rate.mean)), t(" (3 seed ortalaması) seviyesine çıkmıştır.")]),
  bullet("Baseline'da yalnızca seed değiştiğinde başarı %80 ile %100 arasında değişti; RL sonuçlarını tek bir eğitimle raporlamak yanıltıcı olur."),
  bullet([t("Gözlem tasarımı sonucu belirgin biçimde etkiledi: göreli konum kullanmak, ajanın yeni durumlara genellemesini %"), t(pct(rnd.ppo_Absolute8.success_rate.mean)), t("'den %"), t(pct(rnd.ppo_Relative5.success_rate.mean)), t("'e çıkarmıştır.")]),
  P([B("Sonraki adımlar: "), t("Göreli gözleme kenar bilgisi eklemek, hareketli hedef ile hız bilgisinin önemini tekrar test etmek (Hafta 3'teki hareketli hedefe nişan alma konusuyla bağlantılı) ve eğitimi Unity Editor'da Play modunda canlı izlemek.")]),
];

const github = [
  H1("10. GitHub Deposu ve Dosya Yapısı"),
  P([B("Depo: "), link(REPO_URL, REPO_URL)]),
  P([t("Lecture I'de tanımlanan akış izlenmiştir. main dalında temel Unity projesi bulunur. Bu haftanın işi "), C("feature/week05-ml-agents"), t(" dalında anlamlı commit'lerle geliştirilmiş ve Pull Request #1 ile (şablon: .github/pull_request_template.md) main dalına birleştirilmiştir. Unity'nin ürettiği Library, Temp, Logs ve Builds klasörleri .gitignore ile hariç tutulmuştur.")]),
  ...code([
    "Assets/MLAgentsCourse/",
    "  Scripts/   RollerBallAgent.cs, TrainingAreaReplicator.cs, FrameRecorder.cs, CourseArgs.cs",
    "  Editor/    RollerBallSceneBuilder.cs, ReportScreenshots.cs   (menü: ML Agents Course)",
    "  Scenes/    RollerBallTraining, RollerBallInference, RollerBallInference_Relative5",
    "  Models/    RollerBall_U63.onnx, RollerBall_U63_Relative5.onnx",
    "config/      rollerball_2026.yaml, basic_short.yaml",
    "tools/       run_experiments.sh, evaluate.py, run_evaluation.sh, summarize_results.py,",
    "             plot_training.py, make_figures.py, make_gif.py",
    "docs/week05/ README.md (rapor), environment_manifest.md, images/, data/",
  ]),
  P("Projeyi çalıştırmak için: Unity Hub → Add project from disk → depo klasörü (Unity 6000.3.x). Ardından Assets/MLAgentsCourse/Scenes/RollerBallInference.unity sahnesi açılıp Play'e basılır."),
  H2("Yapay zekâ kullanım beyanı"),
  P("Ders politikasına uygun olarak belirtilir: Kurulum adımları, kod iskeleti, deney ve grafik scriptleri ile bu raporun taslağı için bir LLM asistanından (Anthropic Claude) yardım alınmıştır. Ödül, gözlem ve aksiyon tasarımı sunudaki referans çözüme dayanır. Tüm kod okunmuş, çalıştırılmış ve test edilmiştir. Raporda yer alan tüm sayılar gerçek eğitim ve değerlendirme çıktılarından (docs/week05/data) otomatik olarak alınmıştır."),
];

const kaynaklar = [
  H1("Kaynaklar"),
  num3("İ. F. Şentürk, BLM5026 ders sunuları: \"ML-Agents Sunu 1: Advanced Kurulum (Unity 6.3)\" ve \"Sunu 2: Custom RollerAgent (Unity 6.3)\", Bursa Teknik Üniversitesi, 2026."),
  num3([t("Unity Technologies, Unity ML-Agents Toolkit, GitHub deposu, "), link("https://github.com/Unity-Technologies/ml-agents", "https://github.com/Unity-Technologies/ml-agents"), t(" (commit ee0a08c, paket 4.1.0).")]),
  num3("J. Schulman, F. Wolski, P. Dhariwal, A. Radford, O. Klimov, \"Proximal Policy Optimization Algorithms,\" arXiv:1707.06347, 2017."),
  num3("A. Juliani vd., \"Unity: A General Platform for Intelligent Agents,\" arXiv:1809.02627, 2018."),
  num3("R. S. Sutton, A. G. Barto, Reinforcement Learning: An Introduction, 2. baskı, MIT Press, 2018."),
  num3("I. Millington, Artificial Intelligence for Games, 3. baskı, CRC Press, 2019."),
];

// ------------------------------------------------------------------ document
const doc = new Document({
  features: { updateFields: true },
  creator: "Veysel Uğurlu",
  title: "BLM5026 Rapor 4 (Hafta 5): Unity ML-Agents",
  styles: {
    default: { document: { run: { font: "Calibri", size: 22, color: INK } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, color: BLUE }, paragraph: { spacing: { before: 120, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, color: ACCENT }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, color: BLUE }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1300, left: 1440, right: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [t("BLM5026 · Rapor 4 (Hafta 5) · Unity ML-Agents · ", { size: 17, color: "888888" }), new TextRun({ children: [PageNumber.CURRENT], size: 17, color: "888888" })] })] }) },
    children: [...cover, ...toc, ...ozet, ...giris, ...kurulum, ...basic, ...roller, ...degerlendirme, ...ablasyon, ...tartisma, ...sorunlar, ...sonuc, ...github, ...kaynaklar],
  }],
});

const out = process.env.REPORT_OUT || path.join(DOCS, "Rapor4_Hafta5_ML-Agents.docx");
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log("written", out, Math.round(buf.length / 1024), "KB"); });
