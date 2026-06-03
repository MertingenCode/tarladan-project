🌾 Tarladan

Çiftçiden tüketiciye direkt bağlantı — taze, yerel ve güvenilir.

📖 Proje Hakkında
Tarladan, çiftçileri ve üreticileri doğrudan tüketicilerle buluşturan bir platform uygulamasıdır. Aracısız alışveriş deneyimi sunarak hem üreticilerin gelirini artırmayı hem de tüketicilerin taze, yerel ürünlere kolayca ulaşmasını hedefler.

✨ Özellikler

🥕 Ürün Listeleme — Üreticiler ürünlerini kolayca platforma ekleyebilir
🛒 Sepet & Sipariş — Kullanıcı dostu alışveriş deneyimi
👤 Kullanıcı Yönetimi — PocketBase ile kimlik doğrulama ve profil yönetimi
🔍 Ürün Arama & Filtreleme — Kategoriye ve bölgeye göre filtreleme
📦 Gerçek Zamanlı Veri — PocketBase realtime subscriptions ile anlık güncellemeler
📱 Responsive Tasarım — Mobil ve masaüstü uyumlu arayüz


🚀 Kurulum
Gereksinimler

Node.js v18+
PocketBase (backend için)

1. Repoyu Klonlayın
bashgit clone https://github.com/MertingenCode/tarladan-project.git
cd tarladan-project
2. Bağımlılıkları Yükleyin
bashnpm install
3. PocketBase'i Başlatın
PocketBase'i indirin ve çalıştırın:
bash./pocketbase serve
PocketBase admin paneli http://127.0.0.1:8090/_/ adresinde açılır.
4. Ortam Değişkenlerini Ayarlayın
.env dosyası oluşturun:
envVITE_POCKETBASE_URL=http://127.0.0.1:8090
5. Geliştirme Sunucusunu Başlatın
bashnpm run dev
Uygulama http://localhost:5173 adresinde çalışır.

🏗️ Proje Yapısı
tarladan-project/
├── public/               # Statik dosyalar
├── src/
│   ├── components/       # Yeniden kullanılabilir UI bileşenleri
│   ├── pages/            # Sayfa bileşenleri
│   ├── hooks/            # Custom React hook'ları
│   ├── lib/              # PocketBase client & yardımcı fonksiyonlar
│   ├── assets/           # Görseller ve ikonlar
│   └── main.jsx          # Uygulama giriş noktası
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json

🛠️ Teknoloji Yığını
TeknolojiKullanımReact 19UI frameworkVite 8Build aracı & geliştirme sunucusuTailwind CSS 4Stil sistemiPocketBaseBackend, veritabanı & kimlik doğrulamaLucide Reactİkon kütüphanesiReact CompilerOtomatik optimizasyon

📜 Mevcut Scriptler
bashnpm run dev       # Geliştirme sunucusunu başlatır
npm run build     # Production build oluşturur
npm run preview   # Production build'i önizler
npm run lint      # ESLint ile kod kontrolü yapar

🗄️ PocketBase Koleksiyonları
Uygulamanın çalışması için PocketBase'de aşağıdaki koleksiyonların oluşturulması gerekir:
KoleksiyonAçıklamausersKullanıcı hesapları (PocketBase varsayılan)productsÜrün listesi (isim, fiyat, kategori, üretici)ordersSiparişler ve sipariş detaylarıcategoriesÜrün kategorileri

🤝 Katkıda Bulunma
Katkılarınızı bekliyoruz! Lütfen aşağıdaki adımları izleyin:

Projeyi fork'layın
Feature branch oluşturun (git checkout -b feature/yeni-ozellik)
Değişikliklerinizi commit edin (git commit -m 'feat: yeni özellik eklendi')
Branch'inizi push edin (git push origin feature/yeni-ozellik)
Pull Request açın


📄 Lisans
Bu proje MIT Lisansı ile lisanslanmıştır. Detaylar için LICENSE dosyasına bakın.

<p align="center">🌱 Tarladan sofraya, aracısız ve taze</p>
