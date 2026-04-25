import React, { useState, useEffect, useRef } from 'react';
import { 
  Leaf, Search, MapPin, Star, User, ShoppingBag, 
  Package, LogOut, Phone, Mail, ChevronRight, Menu, X, 
  Map, Truck, Store, Plus, CheckCircle, MessageSquare, 
  ShieldCheck, Loader2, BarChart3, Download, Ban, Trash2, 
  AlertCircle, Info, FileText, HelpCircle, Bell, Wallet, CreditCard, Banknote, ListOrdered, History, Edit
} from 'lucide-react';

// GERÇEK ORTAM BAĞLANTISI
import PocketBase from 'pocketbase';
const pb = new PocketBase('https://wav-relay-wool-difficulty.trycloudflare.com ');



const TURKEY_CITIES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin', 'Aydın', 'Balıkesir', 
  'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 
  'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 
  'Hatay', 'Isparta', 'Mersin', 'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 
  'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş', 'Nevşehir', 
  'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Tekirdağ', 'Tokat', 
  'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 
  'Kırıkkale', 'Batman', 'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce'
];

// --- YARDIMCI FONKSİYONLAR ---
const compressImage = async (file) => {
  if (!file || !file.type.startsWith('image/')) return file;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = Math.min(MAX_WIDTH / img.width, 1);
        canvas.width = img.width * scaleSize;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() })), 'image/jpeg', 0.7);
      };
    };
  });
};

const getImageUrl = (record, filename) => {
  if (!filename || filename === '') {
    return 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect width="400" height="400" fill="%2316a34a"/%3E%3Ctext x="50%25" y="50%25" fill="white" font-family="sans-serif" font-size="36" font-weight="bold" text-anchor="middle" dominant-baseline="middle"%3ETarladan%3C/text%3E%3C/svg%3E';
  }
  return pb.files.getUrl(record, filename);
};

const maskName = (name) => {
  if (!name) return 'G***i';
  return name.split(' ').map(word => {
    if (word.length <= 2) return word;
    return word.charAt(0) + '*'.repeat(word.length - 2) + word.charAt(word.length - 1);
  }).join(' ');
};

const filterByDate = (records, filterType) => {
  const now = new Date();
  return records.filter(r => {
    if(filterType === 'all') return true;
    if(!r.created) return true;
    const d = new Date(r.created);
    if(isNaN(d.getTime())) return true;
    
    if(filterType === 'daily') return d.toDateString() === now.toDateString();
    if(filterType === 'weekly') return (now - d) / (1000*60*60*24) <= 7;
    if(filterType === 'monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if(filterType === 'yearly') return d.getFullYear() === now.getFullYear();
    return true;
  });
};

const exportToCSV = (data, headersObj, filename = 'rapor.csv') => {
  if (!data || data.length === 0) return alert("İndirilecek veri bulunamadı.");
  const headersStr = Object.values(headersObj).join(',') + "\n";
  const rowsStr = data.map(item => {
    return Object.keys(headersObj).map(key => {
      let val = item;
      const keys = key.split('.');
      for(let k of keys) { val = val?.[k]; }
      if(key === 'created' && val) val = new Date(val).toLocaleDateString('tr-TR');
      return `"${(val || '').toString().replace(/"/g, '""')}"`;
    }).join(',');
  }).join("\n");
  const blob = new Blob(["\uFEFF" + headersStr + rowsStr], { type: 'text/csv;charset=utf-8;' }); 
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click();
};

const logModeratorAction = async (adminUser, action, details) => {
  if(adminUser.role !== 'admin' && adminUser.role !== 'moderator') return;
  try {
    await pb.collection('moderator_logs').create({ moderator: adminUser.id, action, details });
  } catch(e) { console.error('Log error', e); }
};

// --- OTOMATİK TESLİMAT KONTROLÜ (5 GÜN) ---
const checkAndAutoDeliverOrders = async (orders) => {
  const now = new Date().getTime();
  const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
  let modified = false;
  const updatedOrders = await Promise.all(orders.map(async (o) => {
     if ((o.status === 'Kargoya Verildi' || (o.status === 'Bekliyor' && o.deliveryMethod === 'gel_al')) && o.updated) {
        const updatedTime = new Date(o.updated).getTime();
        if (!isNaN(updatedTime) && (now - updatedTime >= FIVE_DAYS)) {
           try {
              await pb.collection('orders').update(o.id, { status: 'Teslim Edildi' });
              modified = true;
              return { ...o, status: 'Teslim Edildi' };
           } catch(e) { console.error(e); }
        }
     }
     return o;
  }));
  return { orders: updatedOrders, modified };
};

const fileInputClasses = "block w-full text-sm text-gray-700 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-green-600 file:text-white hover:file:bg-green-700 border border-gray-300 rounded-xl p-1.5 bg-white cursor-pointer shadow-sm transition-all";

// --- CUSTOM UI MODALS & COMPONENTS ---
const UIConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText="Evet", isDanger=false }) => {
  if(!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl p-6 md:p-8 max-w-sm w-full shadow-2xl scale-in-center">
        <h3 className="text-xl font-bold mb-3 text-gray-900">{title}</h3>
        <p className="text-gray-600 mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>İptal</Button>
          <Button variant={isDanger ? 'danger' : 'primary'} onClick={onConfirm} className={isDanger ? 'bg-red-600 text-white hover:bg-red-700 border-none' : ''}>{confirmText}</Button>
        </div>
      </div>
    </div>
  )
};

const UIPromptModal = ({ isOpen, title, message, placeholder, onConfirm, onCancel, type="text" }) => {
  const [val, setVal] = useState('');
  if(!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl p-6 md:p-8 max-w-sm w-full shadow-2xl">
        <h3 className="text-xl font-bold mb-3 text-gray-900">{title}</h3>
        <p className="text-gray-600 mb-4 text-sm">{message}</p>
        <input type={type} autoFocus value={val} onChange={e=>setVal(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-gray-300 focus:border-green-500 py-3 px-4 mb-6 outline-none" />
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={()=>{setVal(''); onCancel();}}>İptal</Button>
          <Button onClick={()=>{if(val.trim()){onConfirm(val); setVal('');} else {alert("Bu alan boş bırakılamaz!");}}}>Kaydet</Button>
        </div>
      </div>
    </div>
  )
};

const UICargoModal = ({ isOpen, onConfirm, onCancel }) => {
  const [company, setCompany] = useState('Aras Kargo');
  const [trackingNo, setTrackingNo] = useState('');
  if(!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl p-6 md:p-8 max-w-sm w-full shadow-2xl">
        <h3 className="text-xl font-bold mb-3 text-gray-900">Kargoya Verildi</h3>
        <p className="text-gray-600 mb-4 text-sm">Müşterinin kargosunu takip edebilmesi için firma ve takip kodunu giriniz.</p>
        
        <label className="block text-sm font-medium text-gray-700 mb-1">Kargo Firması</label>
        <select value={company} onChange={e=>setCompany(e.target.value)} className="w-full rounded-lg border border-gray-300 py-2.5 px-3 mb-4 outline-none">
          <option value="Aras Kargo">Aras Kargo</option><option value="Yurtiçi Kargo">Yurtiçi Kargo</option>
          <option value="MNG Kargo">MNG Kargo</option><option value="Sürat Kargo">Sürat Kargo</option>
          <option value="PTT Kargo">PTT Kargo</option>
        </select>

        <label className="block text-sm font-medium text-gray-700 mb-1">Takip / Gönderi Numarası</label>
        <input type="text" autoFocus value={trackingNo} onChange={e=>setTrackingNo(e.target.value)} placeholder="Örn: 1Z99999999" className="w-full rounded-lg border border-gray-300 focus:border-green-500 py-2.5 px-3 mb-6 outline-none" />
        
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={()=>{setTrackingNo(''); onCancel();}}>İptal</Button>
          <Button onClick={()=>{if(trackingNo.trim()){onConfirm({company, trackingNo}); setTrackingNo('');} else {alert("Takip numarası boş bırakılamaz!");}}}>Kaydet</Button>
        </div>
      </div>
    </div>
  )
};

const SimpleBarChart = ({ data, title, color = 'bg-green-500' }) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm w-full">
      <h4 className="font-bold text-gray-800 mb-6">{title}</h4>
      <div className="flex items-end gap-2 h-48 border-b border-gray-200 pb-2">
        {data.map((d, i) => (
           <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
             <div className="absolute -top-8 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">{d.value}₺</div>
             <div className={`w-full ${color} rounded-t-md transition-all hover:opacity-80`} style={{ height: `${(d.value/maxVal)*100}%`, minHeight: d.value > 0 ? '4px' : '0px' }}></div>
             <span className="text-xs text-gray-500 font-medium truncate w-full text-center" title={d.label}>{d.label.substring(0,3)}</span>
           </div>
        ))}
      </div>
    </div>
  )
};

const Button = ({ children, variant = 'primary', className = '', isLoading, ...props }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer";
  const variants = {
    primary: "bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed",
    secondary: "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 disabled:opacity-50",
    outline: "bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 disabled:opacity-50"
  };
  return (
    <button type="button" className={`${baseStyle} ${variants[variant]} ${className}`} disabled={isLoading || props.disabled} {...props}>
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {!isLoading && children}
    </button>
  );
};

const Input = ({ label, icon: Icon, error, defaultValue, ...props }) => (
  <div className="mb-4 w-full">
    {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label} {props.required && <span className="text-red-500">*</span>}</label>}
    <div className="relative">
      {Icon && <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Icon className="h-5 w-5 text-gray-400" /></div>}
      {props.type === 'textarea' ? (
        <textarea defaultValue={defaultValue} className={`w-full rounded-lg border focus:ring-2 py-2.5 px-3 transition-colors resize-none ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-green-500 focus:ring-green-200'}`} {...props} />
      ) : (
        <input defaultValue={defaultValue} className={`w-full rounded-lg border focus:ring-2 py-2.5 ${Icon ? 'pl-10' : 'pl-3'} pr-3 transition-colors ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-green-500 focus:ring-green-200'}`} {...props} />
      )}
    </div>
  </div>
);

const Badge = ({ children, type = 'default' }) => {
  const types = {
    default: "bg-gray-100 text-gray-800", success: "bg-green-100 text-green-800", warning: "bg-yellow-100 text-yellow-800", info: "bg-blue-100 text-blue-800", error: "bg-red-100 text-red-800"
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${types[type]}`}>{children}</span>;
};

// --- KURUMSAL SAYFALAR ---
const AboutView = () => (
  <div className="max-w-4xl mx-auto px-4 py-16 animate-in fade-in">
    <div className="flex items-center gap-3 mb-6">
      <Info className="w-8 h-8 text-green-600" />
      <h1 className="text-4xl font-extrabold text-gray-900">Hakkımızda</h1>
    </div>
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-gray-700 space-y-6 leading-relaxed">
      <p className="text-lg"><strong>Tarladan</strong>, Türkiye'nin dört bir yanındaki yerel çiftçilerle, doğal ve taze ürün arayan tüketicileri aracısız bir şekilde buluşturan yeni nesil bir e-ticaret pazar yeridir.</p>
      <div className="bg-green-50 p-6 rounded-xl border border-green-100 mt-8"><h3 className="text-xl font-bold text-green-900 mb-3">Vizyonumuz</h3><p className="text-green-800">Sürdürülebilir tarımı destekleyerek, herkesin temiz gıdaya erişim hakkını savunmak ve yerel üretimi kalkındırmaktır.</p></div>
    </div>
  </div>
);

const TermsView = () => (
  <div className="max-w-4xl mx-auto px-4 py-16 animate-in fade-in">
    <div className="flex items-center gap-3 mb-6"><FileText className="w-8 h-8 text-gray-800" /><h1 className="text-4xl font-extrabold text-gray-900">Kullanıcı Sözleşmesi</h1></div>
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-gray-700 space-y-6 leading-relaxed text-sm">
      <div><h2 className="font-bold text-lg text-gray-900 mb-2">1. Taraflar ve Kapsam</h2><p>İşbu Kullanıcı Sözleşmesi, Tarladan platformunu kullanan tüm alıcı ve satıcılar arasında geçerlidir.</p></div>
      <hr className="border-gray-100" />
      <div><h2 className="font-bold text-lg text-gray-900 mb-2">2. İade Şartları</h2><p>Siparişlerin kargolanmadan veya teslim alınmadan iptali için satıcı ile iletişime geçilmelidir. Onaylanmış siparişlerin maddi iadeleri Müşteri talebi ve Yönetici/Moderatör onayı ile sağlanır.</p></div>
    </div>
  </div>
);

const PrivacyView = () => (
  <div className="max-w-4xl mx-auto px-4 py-16 animate-in fade-in">
    <div className="flex items-center gap-3 mb-6"><ShieldCheck className="w-8 h-8 text-blue-600" /><h1 className="text-4xl font-extrabold text-gray-900">Gizlilik Politikası</h1></div>
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-gray-700 space-y-6 leading-relaxed text-sm">
      <p className="text-base mb-4 font-medium text-gray-800">Kişisel verilerinizin güvenliğine ve gizliliğine büyük önem veriyoruz.</p>
      <div><h2 className="font-bold text-lg text-gray-900 mb-2">1. Verilerin Paylaşımı</h2><p>Sipariş verdiğinizde kişisel bilgileriniz (isim, adres, telefon) <strong>yalnızca sipariş verdiğiniz satıcı ile paylaşılır.</strong> Haricinde 3. şahıslarla paylaşılmaz.</p></div>
    </div>
  </div>
);

const FaqView = () => {
  const faqs = [
    { q: "Siparişim kaç günde ulaşır?", a: "Siparişleriniz çiftçi tarafından en geç 2 iş günü içerisinde kargoya verilir." },
    { q: "Siparişimi iptal edebilir miyim?", a: "Sipariş kargoya verilmediyse veya teslim edilmediyse iptal edilebilir. Sipariş iptal edildiğinde ya da iade edildiğinde ürün ücreti satıcı bakiyesinden düşülür." },
    { q: "Çiftçi olarak komisyon ödüyor muyum?", a: "Mağaza açmak ve ürün listelemek tamamen ücretsizdir. Sadece başarıyla teslim edilen siparişleriniz üzerinden platform altyapı giderleri için %5 oranında komisyon kesilmektedir." }
  ];
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 animate-in fade-in">
      <div className="flex items-center gap-3 mb-8"><HelpCircle className="w-8 h-8 text-green-600" /><h1 className="text-4xl font-extrabold text-gray-900">Sıkça Sorulan Sorular</h1></div>
      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
            <h3 className="font-bold text-lg text-gray-900 mb-3 flex items-start gap-3"><MessageSquare className="w-6 h-6 text-green-50 shrink-0 mt-0.5"/> {faq.q}</h3>
            <p className="text-gray-600 ml-9 leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
};


// --- ANA GÖRÜNÜMLER ---

const HomeView = ({ navigate, currentUser }) => {
  const [featuredFarmers, setFeaturedFarmers] = useState([]);
  const [localFarmers, setLocalFarmers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [localSearch, setLocalSearch] = useState({ query: '', city: '' });

  useEffect(() => {
    let isMounted = true;
    const fetchFarmers = async () => {
      try {
        const records = await pb.collection('users').getList(1, 6, { filter: 'role="farmer" && is_verified=true', sort: '-rating,-reviewCount' });
        if(isMounted) setFeaturedFarmers(records.items);
        if (currentUser?.city && isMounted) {
          const locRecs = await pb.collection('users').getList(1, 6, { filter: `role="farmer" && is_verified=true && city="${currentUser.city}"`, sort: '-rating' });
          setLocalFarmers(locRecs.items);
        }
      } catch (error) {} finally { if(isMounted) setIsLoading(false); }
    };
    fetchFarmers();
    
    // Realtime List
    const handleUpdate = () => { if(isMounted) fetchFarmers(); };
    pb.collection('users').subscribe('*', handleUpdate);
    return () => { isMounted = false; pb.collection('users').unsubscribe('*', handleUpdate); };
  }, [currentUser]);

  return (
    <div className="animate-in fade-in duration-500">
      {/* Hero Alanı */}
      <section className="relative bg-green-700 text-white py-24 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 overflow-hidden"><img src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=2000" className="w-full h-full object-cover opacity-20" /></div>
        <div className="relative max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight">Tarladan Sofraya,<br/>Aracısız ve Doğal</h1>
          <p className="text-lg md:text-xl text-green-100 mb-10 max-w-2xl mx-auto font-light">Türkiye'nin dört bir yanındaki onaylı yerel çiftçilerimizden doğrudan sipariş edin.</p>
          <form onSubmit={(e) => { e.preventDefault(); navigate('search', { searchParams: localSearch }); }} className="bg-white p-2 rounded-2xl shadow-2xl max-w-3xl mx-auto flex flex-col md:flex-row gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
              <input type="text" placeholder="Mağaza veya ürün ara..." className="w-full pl-12 pr-4 py-3.5 rounded-xl text-gray-900 border-none focus:ring-0 text-lg outline-none" value={localSearch.query} onChange={(e) => setLocalSearch({...localSearch, query: e.target.value})} />
            </div>
            <div className="w-full md:w-64 relative border-t md:border-t-0 md:border-l border-gray-100">
              <MapPin className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
              <select className="w-full pl-12 pr-4 py-3.5 rounded-xl text-gray-900 border-none focus:ring-0 appearance-none bg-transparent text-lg outline-none cursor-pointer" value={localSearch.city} onChange={(e) => setLocalSearch({...localSearch, city: e.target.value})}>
                <option value="">Tüm İller</option>{TURKEY_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Button type="submit" className="md:w-32 py-3.5 rounded-xl text-lg">Bul</Button>
          </form>
        </div>
      </section>

      {/* Öne Çıkanlar */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Öne Çıkan Çiftliklerimiz</h2>
          <p className="text-gray-500 max-w-2xl mx-auto">Müşterilerimizden en yüksek puanı alan, güvenilir ve onaylı yerel üreticilerimiz.</p>
        </div>
        {isLoading ? <div className="flex justify-center py-10"><Loader2 className="w-10 h-10 animate-spin text-green-600" /></div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredFarmers.length > 0 ? featuredFarmers.map(farmer => (
              <div key={farmer.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col cursor-pointer" onClick={() => navigate('store', { farmerId: farmer.id })}>
                <div className="h-56 overflow-hidden relative bg-gray-100">
                  <img src={getImageUrl(farmer, farmer.avatar)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 text-gray-800 shadow-sm"><Star className="w-4 h-4 text-yellow-500 fill-current" /> {farmer.rating > 0 ? farmer.rating.toFixed(1) : 'Yeni'}</div>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{farmer.farmName}</h3>
                  <p className="text-gray-500 text-sm mb-5 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-400"/> {farmer.city}, {farmer.district}</p>
                  <Button variant="outline" className="w-full mt-auto border-green-200 text-green-700 bg-green-50 group-hover:bg-green-600 hover:bg-green-600 group-hover:text-white transition-colors">Mağazayı Ziyaret Et</Button>
                </div>
              </div>
            )) : <p className="text-center col-span-full text-gray-500">Onaylı çiftçi bulunmamaktadır.</p>}
          </div>
        )}
      </section>

      {/* İlinizdeki Çiftçiler */}
      {currentUser?.city && localFarmers.length > 0 && !isLoading && (
        <section className="py-16 bg-gray-50 border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{currentUser.city} İlinizdeki Çiftçiler</h2>
              <p className="text-gray-500">Size en yakın ve en taze ürünleri sunan yerel üreticiler.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {localFarmers.map(farmer => (
                <div key={farmer.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col cursor-pointer" onClick={() => navigate('store', { farmerId: farmer.id })}>
                  <div className="h-56 overflow-hidden relative bg-gray-100">
                    <img src={getImageUrl(farmer, farmer.avatar)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 text-gray-800 shadow-sm"><Star className="w-4 h-4 text-yellow-500 fill-current" /> {farmer.rating > 0 ? farmer.rating.toFixed(1) : 'Yeni'}</div>
                  </div>
                  <div className="p-6 flex flex-col flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{farmer.farmName}</h3>
                    <p className="text-gray-500 text-sm mb-5 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-400"/> {farmer.city}, {farmer.district}</p>
                    <Button variant="outline" className="w-full mt-auto border-green-200 text-green-700 bg-green-50 group-hover:bg-green-600 group-hover:text-white transition-colors">Mağazayı Ziyaret Et</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Amacımız */}
      <section className="py-24 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-extrabold text-gray-900 mb-6 tracking-tight">Biz Kimiz ve <span className="text-green-600">Amacımız Ne?</span></h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Tarladan platformu olarak en büyük amacımız; Türkiye'nin dört bir yanındaki fedakar yerel çiftçilerimizi, en taze, doğal ve sağlıklı ürünleri arayan tüketicilerle <strong>doğrudan ve aracısız</strong> bir şekilde buluşturmaktır.
              </p>
              <div className="space-y-8">
                 <div className="flex gap-5">
                    <div className="bg-green-100 p-4 rounded-2xl h-fit text-green-700 shadow-sm"><Leaf className="w-8 h-8"/></div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 mb-1">Doğal ve Taze</h4>
                      <p className="text-gray-600">Ürünler depolarda beklemeden doğrudan tarladan sofranıza, dalından koptuğu gibi taptaze ulaşır.</p>
                    </div>
                 </div>
                 <div className="flex gap-5">
                    <div className="bg-blue-100 p-4 rounded-2xl h-fit text-blue-700 shadow-sm"><ShieldCheck className="w-8 h-8"/></div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 mb-1">Aracısız Ticaret</h4>
                      <p className="text-gray-600">Aracı komisyoncuları ortadan kaldırarak çiftçimizin hak ettiği kazancı elde etmesini, sizin ise en uygun fiyatlarla alışveriş yapmanızı sağlıyoruz.</p>
                    </div>
                 </div>
                 <div className="flex gap-5">
                    <div className="bg-yellow-100 p-4 rounded-2xl h-fit text-yellow-700 shadow-sm"><User className="w-8 h-8"/></div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 mb-1">Yerel Üreticiye Destek</h4>
                      <p className="text-gray-600">Her siparişinizle kırsal kalkınmaya ve sürdürülebilir tarıma doğrudan destek olmuş olursunuz.</p>
                    </div>
                 </div>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-green-600 rounded-3xl transform translate-x-4 translate-y-4 opacity-10"></div>
              <img src="https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=800" className="w-full rounded-3xl object-cover shadow-2xl relative z-10 h-[600px]" alt="Tarladan Çiftçilerimiz" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const SearchView = ({ navigate, searchParams }) => {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        let filterString = `role="farmer" && is_verified=true`;
        if (searchParams?.city) filterString += ` && city="${searchParams.city}"`;
        if (searchParams?.query) filterString += ` && (farmName~"${searchParams.query}" || name~"${searchParams.query}")`;
        const records = await pb.collection('users').getFullList({ filter: filterString, sort: '-rating' });
        if(isMounted) setResults(records);
      } catch (error) { console.error(error); } finally { if(isMounted) setIsLoading(false); }
    };
    fetchResults();
  }, [searchParams]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-2 text-gray-500 mb-6 text-sm"><span className="cursor-pointer hover:text-green-600" onClick={() => navigate('home')}>Ana Sayfa</span><ChevronRight className="w-4 h-4" /><span className="text-gray-900 font-medium">Arama Sonuçları</span></div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Bulunan Çiftçiler ({results.length})</h2>
      {isLoading ? <div className="flex justify-center py-10"><Loader2 className="w-10 h-10 animate-spin text-green-600" /></div>
      : results.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map(farmer => (
            <div key={farmer.id} className="flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all p-5 cursor-pointer group" onClick={() => navigate('store', { farmerId: farmer.id })}>
              <div className="flex gap-4 mb-4">
                <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0"><img src={getImageUrl(farmer, farmer.avatar)} className="w-full h-full object-cover group-hover:scale-110 transition-transform" /></div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 leading-tight group-hover:text-green-700 transition-colors">{farmer.farmName}</h3>
                  <p className="text-sm text-gray-500 mt-1">{farmer.name}</p>
                  <div className="flex items-center gap-1 mt-2 text-sm text-yellow-600 font-medium"><Star className="w-4 h-4 fill-current" /> {farmer.rating > 0 ? `${farmer.rating.toFixed(1)} (${farmer.reviewCount} Yorum)` : 'Henüz Değerlendirilmedi'}</div>
                </div>
              </div>
              <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                <p className="text-sm text-gray-600 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-400"/> {farmer.city}, {farmer.district}</p>
                <span className="text-green-600 text-sm font-semibold flex items-center">Mağazayı Ziyaret Et <ChevronRight className="w-4 h-4"/></span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100"><Search className="w-16 h-16 text-gray-200 mx-auto mb-4" /><h3 className="text-xl font-bold text-gray-900 mb-2">Sonuç bulunamadı</h3></div>
      )}
    </div>
  );
};

const StoreView = ({ navigate, selectedFarmerId, currentUser, showToast }) => {
  const [farmer, setFarmer] = useState(null);
  const [storeProducts, setStoreProducts] = useState([]);
  const [storeReviews, setStoreReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orderModal, setOrderModal] = useState({ open: false, product: null });
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [deliveryMethod, setDeliveryMethod] = useState('kargo');
  const [isOrdering, setIsOrdering] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchStoreData = async () => {
      try {
        const f = await pb.collection('users').getOne(selectedFarmerId);
        if(isMounted) setFarmer(f);
        if (f.is_verified) {
           const p = await pb.collection('products').getFullList({ filter: `farmer="${selectedFarmerId}" && stock > 0` });
           const r = await pb.collection('reviews').getFullList({ filter: `farmer="${selectedFarmerId}"`, expand: 'buyer', sort: '-created' });
           if(isMounted) { setStoreProducts(p); setStoreReviews(r); }
        }
      } catch (error) {} finally { if(isMounted) setIsLoading(false); }
    };
    if (selectedFarmerId) fetchStoreData();
  }, [selectedFarmerId]);

  const openOrderModal = (product) => {
    if (!currentUser) return navigate('login');
    if (currentUser.role !== 'buyer') return showToast('Sadece müşteri hesapları alışveriş yapabilir.', 'error');
    setOrderModal({ open: true, product }); setOrderQuantity(1); setDeliveryMethod(product.deliveryOpts?.includes('kargo') ? 'kargo' : 'gel_al');
  };

  const confirmOrder = async () => {
    setIsOrdering(true); const { product } = orderModal;
    if (orderQuantity > product.stock) { showToast('Stok yetersiz.', 'error'); setIsOrdering(false); return; }
    try {
      await pb.collection('orders').create({ product: product.id, farmer: farmer.id, buyer: currentUser.id, quantity: orderQuantity, total: product.price * orderQuantity, status: 'Bekliyor', deliveryMethod: deliveryMethod, isReviewed: false });
      await pb.collection('products').update(product.id, { stock: product.stock - orderQuantity });
      showToast(`${product.name} siparişiniz alındı!`, 'success');
      setOrderModal({ open: false, product: null });
      setStoreProducts(storeProducts.map(p => p.id === product.id ? {...p, stock: p.stock - orderQuantity} : p).filter(p => p.stock > 0));
    } catch (error) { showToast('Sipariş oluşturulamadı.', 'error'); } finally { setIsOrdering(false); }
  };

  if (isLoading) return <div className="text-center py-32"><Loader2 className="w-10 h-10 animate-spin text-green-600 mx-auto" /></div>;
  if (!farmer || !farmer.is_verified) return <div className="text-center py-20">Mağaza bulunamadı.</div>;

  return (
    <div className="bg-gray-50 min-h-screen pb-12 animate-in fade-in">
      <div className="bg-white border-b border-gray-200 pt-10 pb-12 px-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8 items-start md:items-center">
          <img src={getImageUrl(farmer, farmer.avatar)} className="w-32 h-32 md:w-40 md:h-40 bg-gray-100 rounded-3xl object-cover flex-shrink-0 shadow-md" />
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">{farmer.farmName} <ShieldCheck className="w-6 h-6 text-green-500" /></h1>
            <p className="text-lg text-gray-600 mb-4">{farmer.name}</p>
            <div className="flex flex-wrap gap-3 text-sm text-gray-700">
              <span className="flex items-center gap-1.5 border border-gray-200 px-3 py-1.5 rounded-lg font-medium"><Phone className="w-4 h-4 text-gray-500"/> {farmer.phone || 'Belirtilmedi'}</span>
              <span className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-lg font-medium"><MapPin className="w-4 h-4 text-gray-500"/> {farmer.city}, {farmer.district}</span>
              <span className="flex items-center gap-1.5 bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-lg font-bold"><Star className="w-4 h-4 fill-current"/> {farmer.rating > 0 ? `${farmer.rating.toFixed(1)} (${farmer.reviewCount} Yorum)` : 'Yeni Mağaza'}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 w-full md:w-auto">
            <Button onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(farmer.adress || farmer.adress + ' ' + farmer.district + ' ' + farmer.city)}`, '_blank')} variant="secondary" className="w-full md:w-48 py-3"><Map className="w-4 h-4" /> Haritada Gör</Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2"><Package className="w-6 h-6 text-green-600"/> Mağazadaki Ürünler</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {storeProducts.map(product => (
              <div key={product.id} onClick={() => openOrderModal(product)} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-lg transition-all flex flex-col cursor-pointer">
                <div className="h-48 overflow-hidden relative bg-gray-100">
                  <img src={getImageUrl(product, product.image)} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <div className="absolute top-3 left-3 flex gap-2">
                    {product.deliveryOpts?.includes('kargo') && <span className="bg-blue-600/90 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1"><Truck className="w-3 h-3"/> Kargo</span>}
                    {product.deliveryOpts?.includes('gel_al') && <span className="bg-green-600/90 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1"><Store className="w-3 h-3"/> Gel Al</span>}
                  </div>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-bold text-gray-900 text-lg group-hover:text-green-700 transition-colors">{product.name}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                  <p className="text-xs text-blue-600 mt-2 font-medium">Stok: {product.stock} {product.unit}</p>
                  <div className="flex justify-between items-end mt-auto pt-4">
                    <div><p className="text-2xl font-black text-green-600">{product.price}₺<span className="text-sm font-normal text-gray-500">/{product.unit}</span></p></div>
                    <Button onClick={(e) => { e.stopPropagation(); openOrderModal(product); }}>Satın Al</Button>
                  </div>
                </div>
              </div>
            ))}
            {storeProducts.length === 0 && (
              <div className="col-span-full bg-white p-8 rounded-2xl border border-dashed border-gray-300 text-center text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" /> Bu satıcının şu an satışta ürünü bulunmamaktadır.
              </div>
            )}
          </div>
        </div>
        <div className="lg:col-span-1">
           <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2"><MessageSquare className="w-6 h-6 text-green-600"/> Müşteri Yorumları</h2>
           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
              {storeReviews.length > 0 ? storeReviews.map(r => {
                let dateStr = '-'; try { const d = new Date(r.created); if (!isNaN(d.getTime())) dateStr = d.toLocaleDateString('tr-TR'); } catch(e){}
                return (
                  <div key={r.id} className="border-b border-gray-100 last:border-0 pb-6 last:pb-0">
                    <div className="flex justify-between mb-2">
                       <div className="font-semibold text-sm">{maskName(r.expand?.buyer?.name)}</div>
                       <div className="flex text-yellow-400">{[...Array(5)].map((_, i) => <Star key={i} className={`w-3 h-3 ${i < r.rating ? 'fill-current' : 'text-gray-200'}`} />)}</div>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{r.comment}</p>
                  </div>
                )
              }) : <p className="text-gray-500 text-sm text-center py-4">Yorum yok.</p>}
           </div>
        </div>
      </div>

      {orderModal.open && orderModal.product && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
             <h3 className="text-2xl font-bold mb-2 text-gray-900">Sipariş Detayları</h3>
             <p className="text-gray-500 text-sm mb-6 border-b pb-4">{orderModal.product.name}</p>
             <div className="space-y-5 mb-6">
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-2">Miktar ({orderModal.product.unit})</label>
                 <div className="flex items-center gap-3">
                   <button type="button" onClick={()=>setOrderQuantity(Math.max(1, orderQuantity-1))} className="w-10 h-10 border rounded-lg hover:bg-gray-50">-</button>
                   <input type="number" value={orderQuantity} readOnly className="w-20 text-center py-2 border rounded-lg font-bold" />
                   <button type="button" onClick={()=>setOrderQuantity(Math.min(orderModal.product.stock, orderQuantity+1))} className="w-10 h-10 border rounded-lg hover:bg-gray-50">+</button>
                 </div>
               </div>
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-2">Teslimat Yöntemi</label>
                 <div className="flex flex-col gap-2">
                   {orderModal.product.deliveryOpts?.includes('kargo') && (
                     <label className={`p-3 border rounded-xl flex items-center gap-3 cursor-pointer ${deliveryMethod === 'kargo' ? 'border-green-600 bg-green-50' : 'hover:bg-gray-50'}`}>
                       <input type="radio" checked={deliveryMethod==='kargo'} onChange={()=>setDeliveryMethod('kargo')} className="w-4 h-4" /> Kargo ile Gönderim
                     </label>
                   )}
                   {orderModal.product.deliveryOpts?.includes('gel_al') && (
                     <label className={`p-3 border rounded-xl flex items-center gap-3 cursor-pointer ${deliveryMethod === 'gel_al' ? 'border-green-600 bg-green-50' : 'hover:bg-gray-50'}`}>
                       <input type="radio" checked={deliveryMethod==='gel_al'} onChange={()=>setDeliveryMethod('gel_al')} className="w-4 h-4" /> Gel-Al
                     </label>
                   )}
                 </div>
                 {deliveryMethod === 'kargo' && <div className="mt-3 bg-blue-50 text-blue-800 p-3 rounded-lg text-sm flex items-start gap-2"><AlertCircle className="w-5 h-5 shrink-0" /><p>Kargo ücretleri teslimatta alıcıya aittir.</p></div>}
               </div>
             </div>
             <div className="bg-gray-50 p-4 rounded-xl mb-6 flex justify-between items-center"><span className="text-gray-600 font-medium">Toplam:</span><span className="text-2xl font-black text-green-600">{orderModal.product.price * orderQuantity}₺</span></div>
             <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setOrderModal({open:false, product:null})} disabled={isOrdering}>İptal</Button><Button isLoading={isOrdering} onClick={confirmOrder}>Siparişi Onayla</Button></div>
          </div>
        </div>
      )}
    </div>
  );
};

const LoginRegisterView = ({ navigate, isLogin, registerRoleParam, showToast }) => {
  const [registerRole, setRegisterRole] = useState(registerRoleParam || 'buyer');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setIsLoading(true);
    const fd = new FormData(e.target); const password = fd.get('password');
    try {
      if (isLogin) {
        await pb.collection('users').authWithPassword(fd.get('email'), password);
        const user = pb.authStore.model; showToast('Başarıyla giriş yapıldı.', 'success');
        if(user.role === 'admin' || user.role === 'moderator') navigate('adminPanel'); else navigate(user.role === 'farmer' ? 'sellerPanel' : 'buyerPanel');
      } else {
        if (password.length < 8) throw new Error("Şifre en az 8 karakter olmalıdır.");
        const file = fd.get('avatar'); if (file && file.size > 0) { fd.set('avatar', await compressImage(file)); } else { fd.delete('avatar'); }
        fd.append('role', registerRole); fd.append('passwordConfirm', password); fd.append('emailVisibility', true);
        fd.append('rating', 0); fd.append('reviewCount', 0); fd.append('is_verified', false);
        await pb.collection('users').create(fd); await pb.collection('users').authWithPassword(fd.get('email'), password);
        showToast(registerRole === 'farmer' ? 'Başvurunuz alındı!' : 'Kayıt başarılı!', 'success');
        navigate(registerRole === 'farmer' ? 'sellerPanel' : 'buyerPanel');
      }
    } catch (err) { showToast(err.message || 'Hata oluştu.', 'error'); } finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 bg-gray-50">
      <div className="max-w-xl w-full space-y-8 bg-white p-8 rounded-3xl shadow-xl">
        <h2 className="text-center text-3xl font-extrabold">{isLogin ? 'Giriş Yap' : 'Kayıt Ol'}</h2>
        {!isLogin && (
          <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
            <button className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${registerRole === 'buyer' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setRegisterRole('buyer')} type="button">Müşteri Kaydı</button>
            <button className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${registerRole === 'farmer' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setRegisterRole('farmer')} type="button">Çiftçi Başvurusu</button>
          </div>
        )}
        <form className="space-y-5" onSubmit={handleSubmit}>
          {!isLogin && <><Input label="Adınız Soyadınız" name="name" required />{registerRole === 'farmer' && <Input label="Mağaza Adı" name="farmName" required />}</>}
          <Input label="E-Posta Adresi" name="email" type="email" required />
          <Input label="Şifre" name="password" type="password" placeholder="En az 8 karakter" required />
          {!isLogin && (
            <>
              <Input label="Telefon" name="phone" required />
              <div className="grid grid-cols-2 gap-4">
                <div className="w-full"><label className="block text-sm font-medium mb-1">İl *</label><select name="city" required className="w-full rounded-lg border border-gray-300 py-2.5 px-3 bg-white outline-none"><option value="">Seçiniz</option>{TURKEY_CITIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <Input label="İlçe" name="district" required />
              </div>
              <Input label="Açık Adres" name="adress" type="textarea" rows="3" required />
              <div className="w-full mt-2">
                 <label className="block text-sm font-bold text-gray-700 mb-2">{registerRole === 'farmer' ? 'Mağaza/Çiftlik Fotoğrafı' : 'Profil Fotoğrafı'} (İsteğe Bağlı)</label>
                 <input type="file" name="avatar" accept="image/*" className={fileInputClasses} />
              </div>
            </>
          )}
          <Button type="submit" isLoading={isLoading} className="w-full py-3.5 text-lg shadow-lg">{isLogin ? 'Giriş Yap' : 'Kayıt Ol'}</Button>
          <div className="text-center text-sm pt-2"><button type="button" className="font-semibold text-green-700 hover:underline" onClick={() => navigate(isLogin ? 'register' : 'login')}>{isLogin ? 'Hemen Kayıt Olun' : 'Zaten üyeyim'}</button></div>
        </form>
      </div>
    </div>
  );
};

const BuyerPanel = ({ currentUser, setCurrentUser, showToast }) => {
  const [activeTab, setActiveTab] = useState('orders');
  const [myOrders, setMyOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [reviewModal, setReviewModal] = useState({ open: false, order: null, rating: 5, comment: '', isSubmitting: false });
  const [confirmData, setConfirmData] = useState({ isOpen: false, type: null, data: null });
  const [dateFilter, setDateFilter] = useState('all');

  const fetchData = async () => {
    try {
      const records = await pb.collection('orders').getFullList({ filter: `buyer="${currentUser.id}"`, expand: 'product,farmer', sort: '-created' });
      const { orders } = await checkAndAutoDeliverOrders(records);
      setMyOrders(orders);
    } catch (error) {} finally { setIsLoading(false); }
  };

  useEffect(() => {
    let isMounted = true;
    fetchData();
    const handleRealtime = () => { if (isMounted) fetchData(); };
    pb.collection('orders').subscribe('*', handleRealtime);
    return () => { isMounted = false; pb.collection('orders').unsubscribe('*', handleRealtime); };
  }, [currentUser]);

  const handleConfirmAction = async () => {
    const { type, data } = confirmData;
    setConfirmData({ isOpen: false, type: null, data: null });

    if (type === 'deliver_order') {
      try {
        await pb.collection('orders').update(data.id, { status: 'Teslim Edildi' });
        setMyOrders(myOrders.map(o => o.id === data.id ? {...o, status: 'Teslim Edildi'} : o));
        showToast('Sipariş teslim edildi olarak işaretlendi.', 'success');
      } catch (err) { showToast('İşlem başarısız.', 'error'); }
    } else if (type === 'cancel_order') {
      try {
        await pb.collection('orders').update(data.id, { status: 'İptal' });
        const product = data?.expand?.product;
        if(product) { try { await pb.collection('products').update(product.id, { stock: product.stock + data.quantity }); } catch(e){} }
        setMyOrders(myOrders.map(o => o.id === data.id ? {...o, status: 'İptal'} : o));
        showToast('Sipariş iptal edildi.', 'success');
      } catch(e) { showToast('İptal işlemi başarısız.', 'error'); }
    }
  };

  const submitReview = async () => {
    if (!reviewModal.comment.trim()) return showToast("Lütfen bir yorum yazın.", 'error');
    setReviewModal({...reviewModal, isSubmitting: true});
    try {
      const order = reviewModal.order; const farmer = order.expand.farmer;
      await pb.collection('reviews').create({ order: order.id, farmer: order.farmer, buyer: currentUser.id, rating: reviewModal.rating, comment: reviewModal.comment });
      await pb.collection('orders').update(order.id, { isReviewed: true });
      const newReviewCount = farmer.reviewCount + 1;
      const newRating = ((farmer.rating * farmer.reviewCount) + reviewModal.rating) / newReviewCount;
      await pb.collection('users').update(farmer.id, { rating: newRating, reviewCount: newReviewCount });
      setMyOrders(myOrders.map(o => o.id === order.id ? { ...o, isReviewed: true } : o));
      showToast("Değerlendirmeniz başarıyla kaydedildi!", "success");
      setReviewModal({ open: false, order: null, rating: 5, comment: '', isSubmitting: false });
    } catch (error) { showToast("Yorum kaydedilemedi.", "error"); setReviewModal({...reviewModal, isSubmitting: false}); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault(); setIsUpdating(true);
    try {
      const fd = new FormData(e.target);
      const file = fd.get('avatar'); if (file && file.size > 0) fd.set('avatar', await compressImage(file)); else fd.delete('avatar');
      const updatedUser = await pb.collection('users').update(currentUser.id, fd);
      setCurrentUser(updatedUser); showToast('Güncellendi.', 'success');
    } catch (err) { showToast('Başarısız.', 'error'); } finally { setIsUpdating(false); }
  };

  const displayedOrders = filterByDate(myOrders, dateFilter);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 flex flex-col md:flex-row gap-8 animate-in fade-in">
      <UIConfirmModal 
        isOpen={confirmData.isOpen} 
        title={confirmData.type === 'cancel_order' ? 'Siparişi İptal Et' : 'Siparişi Teslim Aldınız mı?'} 
        message={confirmData.type === 'cancel_order' ? 'Bu siparişi iptal etmek istediğinize emin misiniz? İşlem geri alınamaz.' : 'Bu ürünü eksiksiz ve sorunsuz teslim aldığınızı onaylıyor musunuz? Bu işlem geri alınamaz.'} 
        confirmText={confirmData.type === 'cancel_order' ? 'İptal Et' : 'Teslim Aldım'} 
        isDanger={confirmData.type === 'cancel_order'} 
        onCancel={()=>setConfirmData({isOpen:false, type:null, data:null})} 
        onConfirm={handleConfirmAction} 
      />
      
      <div className="w-full md:w-72 space-y-3 flex-shrink-0">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center mb-6">
          <img src={getImageUrl(currentUser, currentUser.avatar)} className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-white shadow-sm object-cover bg-gray-100" />
          <h3 className="font-extrabold text-lg text-gray-900">{currentUser?.name}</h3>
        </div>
        <Button variant={activeTab === 'orders' ? 'secondary' : 'outline'} className={`w-full justify-start py-3 ${activeTab !== 'orders' && 'border-none bg-white'}`} onClick={() => setActiveTab('orders')}><ShoppingBag className="w-5 h-5"/> Siparişlerim</Button>
        <Button variant={activeTab === 'settings' ? 'secondary' : 'outline'} className={`w-full justify-start py-3 ${activeTab !== 'settings' && 'border-none bg-white'}`} onClick={() => setActiveTab('settings')}><User className="w-5 h-5"/> Profil ve Adres</Button>
      </div>
      
      <div className="flex-1 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm min-h-[600px] flex flex-col">
        {activeTab === 'orders' && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h2 className="text-2xl font-bold text-gray-900">Sipariş Geçmişim</h2>
              <div className="flex gap-2">
                <select className="border border-gray-300 rounded-lg py-2 px-3 text-sm outline-none" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}>
                  <option value="all">Tüm Geçmiş</option><option value="daily">Bugün</option><option value="weekly">Son 7 Gün</option><option value="monthly">Bu Ay</option><option value="yearly">Bu Yıl</option>
                </select>
                <Button variant="outline" onClick={() => {
                  const exportData = displayedOrders.map(o => ({
                    "Sipariş No": o.id,
                    "Tarih": new Date(o.created).toLocaleDateString('tr-TR'),
                    "Satıcı": o.expand?.farmer?.farmName || '-',
                    "Ürün": o.expand?.product?.name || '-',
                    "Miktar": o.quantity,
                    "Birim": o.expand?.product?.unit || '-',
                    "Tutar (TL)": o.total,
                    "Kargo Firması": o.cargoCompany || '-',
                    "Takip No": o.trackingNumber || '-',
                    "Durum": o.status
                  }));
                  exportToCSV(exportData, {}, 'siparislerim.csv');
                }}><Download className="w-4 h-4 mr-2"/> Excel</Button>
              </div>
            </div>
            {isLoading ? <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div> : (
              <div className="space-y-4">
                {displayedOrders.length > 0 ? displayedOrders.map(order => {
                  const product = order?.expand?.product || { name: 'Silinmiş Ürün', unit: '' };
                  const farmer = order?.expand?.farmer || { farmName: 'Bilinmeyen Satıcı' };
                  return (
                    <div key={order.id} className="border border-gray-100 rounded-xl p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <img src={order?.expand?.product ? getImageUrl(product, product.image) : ''} className="w-16 h-16 bg-gray-100 rounded-lg object-cover shrink-0"/>
                        <div>
                          <div className="flex items-center gap-2 mb-1"><span className="font-bold">{product?.name}</span><Badge type={order.status === 'Teslim Edildi' ? 'success' : (order.status==='İptal' || order.status==='İade Edildi' ? 'error' : 'warning')}>{order.status}</Badge></div>
                          <p className="text-sm text-gray-600 mb-1">Satıcı: {farmer?.farmName}</p>
                          <p className="text-sm text-gray-500">Miktar: {order.quantity} {product?.unit} • {order.deliveryMethod}</p>
                          {order.trackingNumber && <p className="text-sm text-blue-600 font-medium mt-1 border border-blue-200 bg-blue-50 px-2 py-1 rounded inline-block">Kargo: {order.cargoCompany} - Takip: {order.trackingNumber}</p>}
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-3 w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0">
                        <p className="text-xl font-black text-green-600">{order.total}₺</p>
                        {order.status === 'Bekliyor' && <Button variant="danger" size="sm" onClick={() => setConfirmData({isOpen: true, type: 'cancel_order', data: order})}><X className="w-4 h-4 mr-1"/>İptal Et</Button>}
                        {order.status === 'Kargoya Verildi' && <Button size="sm" onClick={() => setConfirmData({isOpen: true, type: 'deliver_order', data: order})}><CheckCircle className="w-4 h-4 mr-1"/>Teslim Aldım</Button>}
                        {order.status === 'Teslim Edildi' && !order.isReviewed && <Button size="sm" onClick={() => setReviewModal({ open: true, order: order, rating: 5, comment: '' })}>Değerlendir</Button>}
                        {order.isReviewed && <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded">Değerlendirildi</span>}
                      </div>
                    </div>
                  )
                }) : <p className="text-gray-500 py-8 text-center bg-gray-50 rounded-xl border border-dashed">Kayıt bulunmamaktadır.</p>}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Kişisel ve Adres Bilgilerim</h2>
            <form className="max-w-2xl space-y-4" onSubmit={handleUpdate}>
              <div className="w-full mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">Profil Fotoğrafını Güncelle</label>
                <input type="file" name="avatar" accept="image/*" className={fileInputClasses} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Ad Soyad" name="name" defaultValue={currentUser?.name} required /><Input label="Telefon" name="phone" defaultValue={currentUser?.phone} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="w-full"><label className="block text-sm mb-1">İl *</label><select name="city" defaultValue={currentUser?.city} required className="w-full rounded-lg border py-2.5 px-3">{TURKEY_CITIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <Input label="İlçe" name="district" defaultValue={currentUser?.district} required />
              </div>
              <Input label="Açık Adres" name="adress" type="textarea" rows="3" defaultValue={currentUser?.adress} required />
              <Button type="submit" isLoading={isUpdating} className="px-8">Değişiklikleri Kaydet</Button>
            </form>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewModal.open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
             <h3 className="text-xl font-bold mb-4">Siparişi Değerlendir</h3>
             <div className="flex justify-center gap-2 mb-6">
               {[1,2,3,4,5].map(star => <button key={star} onClick={() => setReviewModal({...reviewModal, rating: star})} className="focus:outline-none"><Star className={`w-10 h-10 transition-colors ${star <= reviewModal.rating ? 'text-yellow-400 fill-current scale-110' : 'text-gray-200'}`} /></button>)}
             </div>
             <textarea className="w-full border rounded-xl p-4 mb-6 focus:ring-2 outline-none resize-none" rows="4" placeholder="Yorumunuz..." value={reviewModal.comment} onChange={e => setReviewModal({...reviewModal, comment: e.target.value})}></textarea>
             <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setReviewModal({open:false})}>İptal</Button><Button isLoading={reviewModal.isSubmitting} onClick={submitReview}>Gönder</Button></div>
          </div>
        </div>
      )}
    </div>
  );
};

const SellerPanel = ({ currentUser, setCurrentUser, showToast }) => {
  const [activeTab, setActiveTab] = useState('products'); 
  const [myProducts, setMyProducts] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [myPayouts, setMyPayouts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');

  const [showProductModal, setShowProductModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null); 
  
  const [confirmData, setConfirmData] = useState({ isOpen: false, type: null, data: null });
  const [cargoModalData, setCargoModalData] = useState({ isOpen: false, data: null });
  const [payoutPrompt, setPayoutPrompt] = useState(false);

  const fetchData = async () => {
    try {
      const [p, o, pay] = await Promise.all([
        pb.collection('products').getFullList({ filter: `farmer="${currentUser.id}"`, sort: '-created' }),
        pb.collection('orders').getFullList({ filter: `farmer="${currentUser.id}"`, expand: 'product,buyer', sort: '-created' }),
        pb.collection('payouts').getFullList({ filter: `farmer="${currentUser.id}"`, sort: '-created' }).catch(()=>[])
      ]);
      const { orders } = await checkAndAutoDeliverOrders(o);
      setMyProducts(p); setMyOrders(orders); setMyPayouts(pay);
    } catch (error) {} finally { setIsLoading(false); }
  };

  useEffect(() => {
    if (!currentUser?.is_verified) return;
    let isMounted = true;
    fetchData();

    const handleRealtime = () => { if(isMounted) fetchData(); };
    pb.collection('orders').subscribe('*', handleRealtime);
    pb.collection('products').subscribe('*', handleRealtime);
    pb.collection('payouts').subscribe('*', handleRealtime);

    return () => {
      isMounted = false;
      pb.collection('orders').unsubscribe('*', handleRealtime);
      pb.collection('products').unsubscribe('*', handleRealtime);
      pb.collection('payouts').unsubscribe('*', handleRealtime);
    };
  }, [currentUser]);

  if (!currentUser?.is_verified) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center animate-in fade-in">
        <div className="w-24 h-24 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6"><ShieldCheck className="w-12 h-12" /></div>
        <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Başvurunuz İnceleniyor</h2>
        <p className="text-lg text-gray-600 bg-white p-8 rounded-2xl shadow-sm border">Bilgileriniz doğrulandıktan sonra mağazanız aktif edilecektir.</p>
      </div>
    );
  }

  const handleConfirmAction = async () => {
    const { type, data } = confirmData;
    setConfirmData({ isOpen: false, type: null, data: null });

    if (type === 'cancel_order') {
      try {
        await pb.collection('orders').update(data.id, { status: 'İptal' });
        const product = data?.expand?.product;
        if(product) {
          try { await pb.collection('products').update(product.id, { stock: product.stock + data.quantity }); } catch(e){ console.error("Stok ekleme hatası:", e); }
        }
        setMyOrders(myOrders.map(o => o.id === data.id ? {...o, status: 'İptal'} : o));
        showToast(`Sipariş iptal edildi, stoklar geri eklendi.`, 'success');
      } catch(e) { showToast("İptal işlemi başarısız.", 'error'); console.error(e); }
    } 
    else if (type === 'delete_product') {
      try {
        await pb.collection('products').delete(data);
        setMyProducts(myProducts.filter(p => p.id !== data));
        showToast('Ürün silindi.', 'success');
      } catch(e) { showToast('Silme başarısız.', 'error'); console.error(e); }
    }
  };

  const handleCargoAction = async ({ company, trackingNo }) => {
    const order = cargoModalData.data; setCargoModalData({ isOpen: false, data: null });
    try {
      await pb.collection('orders').update(order.id, { status: 'Kargoya Verildi', trackingNumber: trackingNo, cargoCompany: company });
      setMyOrders(myOrders.map(o => o.id === order.id ? {...o, status: 'Kargoya Verildi', trackingNumber: trackingNo, cargoCompany: company} : o));
      showToast(`Sipariş kargoya verildi olarak işaretlendi.`, 'success');
    } catch(e) { showToast("Güncelleme başarısız.", 'error'); console.error(e); }
  };

  const markAsGelAl = async (order) => {
    try {
      await pb.collection('orders').update(order.id, { status: 'Teslim Edildi' });
      setMyOrders(myOrders.map(o => o.id === order.id ? {...o, status: 'Teslim Edildi'} : o));
      showToast(`Sipariş Teslim Edildi yapıldı.`, 'success');
    } catch(e) { showToast("Güncelleme başarısız.", 'error'); console.error(e); }
  };

  const handlePayoutRequest = async (amountStr) => {
    setPayoutPrompt(false);
    const amount = parseFloat(amountStr);
    if(isNaN(amount) || amount <= 0) return showToast("Geçersiz miktar.", "error");
    if(amount > financeStats.availableBalance) return showToast("Bakiyeniz yetersiz.", "error");
    if(!currentUser?.iban) return showToast("Lütfen mağaza ayarlarından IBAN bilginizi ekleyin.", "error");

    try {
      const pReq = await pb.collection('payouts').create({ farmer: currentUser.id, amount, iban: currentUser.iban, status: 'bekliyor' });
      setMyPayouts([pReq, ...myPayouts]);
      showToast("Para çekme talebiniz alındı.", "success");
    } catch(e){ showToast("Talep oluşturulamadı.", "error"); console.error(e); }
  };

  const handleAddOrUpdateProduct = async (e) => {
    e.preventDefault(); setIsUpdating(true);
    try {
      const fd = new FormData(e.target); fd.append('farmer', currentUser.id);
      const file = fd.get('image'); 
      if (file && file.size > 0) fd.set('image', await compressImage(file)); else fd.delete('image');
      
      const delOpts = []; if (fd.get('opt_kargo')) delOpts.push('kargo'); if (fd.get('opt_gelal')) delOpts.push('gel_al');
      if (delOpts.length === 0) throw new Error('En az bir teslimat seçeneği seçin.');
      fd.append('deliveryOpts', JSON.stringify(delOpts));
      
      if(editProduct) {
        const updatedP = await pb.collection('products').update(editProduct.id, fd);
        setMyProducts(myProducts.map(p => p.id === editProduct.id ? updatedP : p));
        showToast('Ürün güncellendi.', 'success');
      } else {
        const newProd = await pb.collection('products').create(fd);
        setMyProducts([newProd, ...myProducts]);
        showToast('Ürün Eklendi.', 'success');
      }
      setShowProductModal(false); setEditProduct(null);
    } catch (err) { showToast(err.message, 'error'); console.error(err); } finally { setIsUpdating(false); }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault(); setIsUpdating(true);
    try {
      const fd = new FormData(e.target);
      const file = fd.get('avatar'); if (file && file.size > 0) fd.set('avatar', await compressImage(file)); else fd.delete('avatar');
      const updatedUser = await pb.collection('users').update(currentUser.id, fd);
      setCurrentUser(updatedUser); showToast('Mağaza ayarları güncellendi.', 'success');
    } catch (err) { showToast('Başarısız oldu.', 'error'); console.error(err); } finally { setIsUpdating(false); }
  };

  const displayedOrders = filterByDate(myOrders, dateFilter);
  const displayedPayouts = filterByDate(myPayouts, dateFilter);

  const calcFinanceStats = () => {
    const now = new Date().getTime();
    const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
    
    const deliveredOrders = myOrders.filter(o => o.status === 'Teslim Edildi');
    const availableOrders = deliveredOrders.filter(o => o.isReviewed || (o.updated && (now - new Date(o.updated).getTime()) >= FIVE_DAYS));
    const pendingDeliveredOrders = deliveredOrders.filter(o => !o.isReviewed && (!o.updated || (now - new Date(o.updated).getTime()) < FIVE_DAYS));

    const grossAvailable = availableOrders.reduce((acc, o) => acc + o.total, 0);
    const netAvailable = grossAvailable * 0.95;
    
    const totalPayouts = myPayouts.filter(p => p.status !== 'reddedildi').reduce((acc, p) => acc + p.amount, 0);
    
    const pendingGross = myOrders.filter(o => o.status === 'Kargoya Verildi' || o.status === 'Bekliyor').reduce((acc, o) => acc + o.total, 0) + pendingDeliveredOrders.reduce((acc, o) => acc + o.total, 0);
    const pendingNet = pendingGross * 0.95;
    
    return { availableBalance: netAvailable - totalPayouts, pendingEarn: pendingNet };
  };
  const financeStats = calcFinanceStats();

  const calculateStats = () => {
    const today = new Date();
    const last7Days = Array(7).fill(0).map((_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - i);
      return { label: d.toLocaleDateString('tr-TR', { weekday: 'short' }), dateStr: d.toISOString().split('T')[0], value: 0 };
    }).reverse();
    const currentYearStr = today.getFullYear().toString();
    const monthlyStats = Array(12).fill(0).map((_, i) => ({ label: (i+1)+'. Ay', month: i+1, value: 0 }));

    displayedOrders.filter(o => o.status !== 'İptal' && o.status !== 'İade Edildi').forEach(o => {
      try {
        if (!o.created) return;
        const orderDate = new Date(o.created);
        const dateStr = orderDate.toISOString().split('T')[0];
        const dayObj = last7Days.find(d => d.dateStr === dateStr);
        if (dayObj) dayObj.value += (o.total || 0);
        if (orderDate.getFullYear().toString() === currentYearStr) monthlyStats[orderDate.getMonth()].value += (o.total || 0);
      } catch (e) {}
    });
    return { last7Days, monthlyStats };
  };
  const stats = calculateStats();

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 flex flex-col md:flex-row gap-8 animate-in fade-in">
      
      <UIConfirmModal isOpen={confirmData.isOpen} title={confirmData.type === 'cancel_order' ? 'Siparişi İptal Et' : 'Ürünü Sil'} message={confirmData.type === 'cancel_order' ? 'Bu siparişi iptal etmek istediğinize emin misiniz? Ürün stoğu geri eklenecektir.' : 'Bu ürünü kalıcı olarak silmek istediğinize emin misiniz?'} isDanger={true} confirmText={confirmData.type === 'cancel_order' ? "Siparişi İptal Et" : "Sil"} onCancel={()=>setConfirmData({isOpen:false, type:null, data:null})} onConfirm={handleConfirmAction} />
      <UICargoModal isOpen={cargoModalData.isOpen} onCancel={()=>setCargoModalData({isOpen:false, data:null})} onConfirm={handleCargoAction} />
      <UIPromptModal isOpen={payoutPrompt} title="Para Çekme Talebi" message={`Kullanılabilir Bakiyeniz: ${financeStats.availableBalance.toFixed(2)}₺. (Teslim edildikten 5 gün sonra para çekilebilir)`} type="number" placeholder="Örn: 500" onCancel={()=>setPayoutPrompt(false)} onConfirm={handlePayoutRequest} />

      <div className="w-full md:w-72 space-y-3 flex-shrink-0">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center mb-6">
          <img src={getImageUrl(currentUser, currentUser.avatar)} className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-white shadow-sm object-cover bg-gray-100" />
          <h3 className="font-extrabold text-lg">{currentUser?.farmName}</h3>
          <p className="text-sm text-green-600 font-bold mt-1 bg-green-50 rounded-full inline-block px-3 py-1">Onaylı Mağaza</p>
        </div>
        <Button variant={activeTab === 'products' ? 'secondary' : 'outline'} className={`w-full justify-start py-3 ${activeTab !== 'products' && 'border-none bg-white'}`} onClick={() => setActiveTab('products')}><Package className="w-5 h-5"/> Ürünlerim</Button>
        <Button variant={activeTab === 'orders' ? 'secondary' : 'outline'} className={`w-full justify-start py-3 ${activeTab !== 'orders' && 'border-none bg-white'}`} onClick={() => setActiveTab('orders')}><ShoppingBag className="w-5 h-5"/> Sipariş Yönetimi {myOrders.filter(o => o.status === 'Bekliyor').length > 0 && <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{myOrders.filter(o => o.status === 'Bekliyor').length}</span>}</Button>
        <Button variant={activeTab === 'stats' ? 'secondary' : 'outline'} className={`w-full justify-start py-3 ${activeTab !== 'stats' && 'border-none bg-white'}`} onClick={() => setActiveTab('stats')}><BarChart3 className="w-5 h-5"/> Satış İstatistikleri</Button>
        <Button variant={activeTab === 'finance' ? 'secondary' : 'outline'} className={`w-full justify-start py-3 ${activeTab !== 'finance' && 'border-none bg-white'}`} onClick={() => setActiveTab('finance')}><Wallet className="w-5 h-5"/> Cüzdan & Finans</Button>
        <Button variant={activeTab === 'settings' ? 'secondary' : 'outline'} className={`w-full justify-start py-3 ${activeTab !== 'settings' && 'border-none bg-white'}`} onClick={() => setActiveTab('settings')}><Store className="w-5 h-5"/> Mağaza Ayarları</Button>
      </div>
      
      <div className="flex-1 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm min-h-[600px]">
        {isLoading ? <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-green-600" /></div> : (
          <>
            {activeTab === 'products' && (
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                  <h2 className="text-2xl font-bold text-gray-900">Ürün Yönetimi</h2>
                  <Button onClick={() => { setEditProduct(null); setShowProductModal(true); }} className="shadow-lg"><Plus className="w-5 h-5 mr-1"/> Yeni Ürün Ekle</Button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold uppercase text-xs tracking-wider">
                      <tr><th className="p-4">Ürün Görseli & Adı</th><th className="p-4">Fiyat</th><th className="p-4">Stok</th><th className="p-4 text-right">İşlem</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {myProducts.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="p-4 font-bold flex items-center gap-4"><img src={getImageUrl(p, p.image)} className="w-12 h-12 rounded-lg object-cover border shadow-sm" />{p.name}</td>
                          <td className="p-4 font-semibold">{p.price}₺ / {p.unit}</td>
                          <td className="p-4"><Badge type={p.stock < 10 ? 'error' : 'success'}>{p.stock}</Badge></td>
                          <td className="p-4 text-right">
                             <button onClick={()=>{ setEditProduct(p); setShowProductModal(true); }} className="text-blue-600 font-medium hover:underline mr-4"><Edit className="w-4 h-4 inline"/></button>
                             <button onClick={()=>setConfirmData({isOpen:true, type:'delete_product', data:p.id})} className="text-red-600 font-medium hover:underline"><Trash2 className="w-4 h-4 inline"/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
                  <h2 className="text-2xl font-bold flex items-center gap-2">Gelen Siparişler <Bell className="w-5 h-5 text-green-600"/></h2>
                  <div className="flex gap-2">
                    <select className="border border-gray-300 rounded-lg py-2 px-3 text-sm font-medium outline-none" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}>
                      <option value="all">Tüm Zamanlar</option><option value="daily">Bugün</option><option value="weekly">Bu Hafta</option><option value="monthly">Bu Ay</option>
                    </select>
                    <Button variant="outline" onClick={() => {
                      const exportData = displayedOrders.map(o => ({
                        "Sipariş No": o.id,
                        "Tarih": new Date(o.created).toLocaleDateString('tr-TR'),
                        "Müşteri": o.expand?.buyer?.name || '-',
                        "Ürün": o.expand?.product?.name || '-',
                        "Miktar": o.quantity,
                        "Tutar (TL)": o.total,
                        "Teslimat Yöntemi": o.deliveryMethod,
                        "Kargo Firması": o.cargoCompany || '-',
                        "Takip No": o.trackingNumber || '-',
                        "Durum": o.status
                      }));
                      exportToCSV(exportData, {}, 'satislar.csv');
                    }}><Download className="w-4 h-4 mr-2"/> Excel İndir</Button>
                  </div>
                </div>
                <div className="space-y-5">
                  {displayedOrders.length > 0 ? displayedOrders.map(order => {
                    const product = order?.expand?.product || { name: 'Silinmiş', unit: '' };
                    const buyer = order?.expand?.buyer || { name: 'Bilinmeyen' };
                    return (
                      <div key={order.id} className={`border ${order.status === 'İptal' || order.status === 'İade Edildi' ? 'border-red-200 bg-red-50/20' : 'border-gray-200 bg-gray-50/30'} rounded-xl p-6`}>
                        <div className="flex justify-between items-center border-b pb-4 mb-4">
                          <div className="font-extrabold text-gray-900">Sipariş ID: <span className="text-green-700">{order.id}</span></div>
                          <Badge type={order.status === 'Bekliyor' ? 'error' : (order.status==='İptal' || order.status==='İade Edildi' ? 'error' : 'success')}>{order.status}</Badge>
                        </div>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                          <div className="space-y-2 flex-1">
                            <p className="text-sm font-medium bg-white p-2 rounded border inline-block w-full">Ürün: {product?.name} ({order.quantity} {product?.unit})</p>
                            <div className="grid grid-cols-2 gap-4">
                              <div><p className="text-xs text-gray-500 mb-1">Müşteri</p><p className="text-sm font-bold">{buyer?.name}</p><p className="text-sm">{buyer?.phone}</p></div>
                              <div><p className="text-xs text-gray-500 mb-1">Tutar & Teslimat</p><p className="text-sm font-bold">{order.total}₺</p><p className="text-sm">{order.deliveryMethod}</p></div>
                            </div>
                            <div className="bg-gray-100 p-3 rounded-lg mt-2 text-sm text-gray-700"><strong>Adres:</strong> {buyer?.adress || buyer?.adress}, {buyer?.district} / {buyer?.city}</div>
                          </div>
                          {order.status === 'Bekliyor' && (
                            <div className="flex flex-col gap-2 w-full md:w-auto">
                              {order.deliveryMethod === 'kargo' && <Button onClick={() => setCargoModalData({isOpen:true, data:order})} className="w-full"><Truck className="w-4 h-4 mr-2" /> Kargoya Ver</Button>}
                              <Button variant="danger" onClick={() => setConfirmData({isOpen:true, type:'cancel_order', data:order})} className="w-full"><X className="w-4 h-4 mr-2" /> İptal Et</Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }) : <p className="text-gray-500 py-8 text-center bg-gray-50 rounded-xl border border-dashed">Sipariş bulunmuyor.</p>}
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                   <h2 className="text-2xl font-bold">Satış Analizi</h2>
                   <select className="border border-gray-300 rounded-lg py-2 px-3 text-sm font-medium outline-none" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}><option value="all">Tüm Zamanlar</option><option value="monthly">Bu Ay</option></select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <SimpleBarChart data={stats.last7Days} title="Son 7 Günlük Satış Hacmi (₺)" color="bg-green-500" />
                  <SimpleBarChart data={stats.monthlyStats} title="Bu Yılki Aylık Satış Hacmi (₺)" color="bg-blue-500" />
                </div>
              </div>
            )}

            {activeTab === 'finance' && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-gray-900">Cüzdan & Finans</h2>
                
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-xl mb-6 flex items-start gap-3 shadow-sm">
                  <Info className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm">
                    <strong>Bilgilendirme:</strong> Platformumuzda mağaza açmak ücretsizdir. Yalnızca <b>başarıyla teslim edilen</b> siparişler üzerinden sistem altyapı maliyetleri için <b>%5 oranında komisyon</b> kesintisi yapılmaktadır. Bekleyen kazancınız ve kullanılabilir bakiyeniz komisyon düşülmüş <b>net tutarları</b> göstermektedir.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                   <div className="bg-green-50 p-6 rounded-xl border border-green-100 flex flex-col justify-center">
                     <p className="text-sm font-bold text-green-700 mb-1 flex items-center gap-1"><Wallet className="w-4 h-4"/> Kullanılabilir Bakiye (Net)</p>
                     <p className="text-3xl font-black text-green-800">{financeStats.availableBalance.toFixed(2)}₺</p>
                   </div>
                   <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-100 flex flex-col justify-center">
                     <p className="text-sm font-bold text-yellow-700 mb-1 flex items-center gap-1"><Package className="w-4 h-4"/> Bekleyen Kazanç (Net)</p>
                     <p className="text-2xl font-black text-yellow-800">{financeStats.pendingEarn.toFixed(2)}₺</p>
                     <p className="text-[10px] text-yellow-600 mt-1 leading-tight">Teslim edilmeyen veya 5 günü doldurmayan siparişler</p>
                   </div>
                   <div className="bg-white p-6 rounded-xl border border-gray-200 flex flex-col justify-center gap-2">
                     {!currentUser?.iban && <p className="text-xs text-red-500 font-bold">Para çekmek için Ayarlar'dan IBAN ekleyin.</p>}
                     <Button onClick={() => setPayoutPrompt(true)} disabled={financeStats.availableBalance <= 0 || !currentUser?.iban} className="w-full h-full py-4 text-lg"><Banknote className="w-5 h-5"/> Para Çek</Button>
                   </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                  <h3 className="font-bold text-lg text-gray-900">Para Çekme Geçmişi</h3>
                  <div className="flex gap-2">
                    <select className="border border-gray-300 rounded-lg py-2 px-3 text-sm font-medium outline-none" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}>
                      <option value="all">Tüm Zamanlar</option><option value="daily">Bugün</option><option value="weekly">Bu Hafta</option><option value="monthly">Bu Ay</option><option value="yearly">Bu Yıl</option>
                    </select>
                    <Button variant="outline" onClick={() => {
                      const exportData = displayedPayouts.map(p => ({
                        "Tarih": new Date(p.created).toLocaleDateString('tr-TR'),
                        "Miktar (TL)": p.amount,
                        "IBAN": p.iban,
                        "Durum": p.status
                      }));
                      exportToCSV(exportData, {}, 'para_cekme_gecmisi.csv');
                    }}><Download className="w-4 h-4 mr-2"/> Excel İndir</Button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b text-gray-700 font-bold uppercase text-xs">
                      <tr><th className="p-4">Tarih</th><th className="p-4">Miktar</th><th className="p-4">IBAN</th><th className="p-4 text-right">Durum</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {displayedPayouts.map(p => (
                        <tr key={p.id}>
                          <td className="p-4">{new Date(p.created).toLocaleDateString('tr-TR')}</td>
                          <td className="p-4 font-bold text-gray-900">{p.amount}₺</td>
                          <td className="p-4 text-gray-500 font-mono text-xs">{p.iban}</td>
                          <td className="p-4 text-right"><Badge type={p.status === 'odendi' ? 'success' : (p.status === 'reddedildi' ? 'error' : 'warning')}>{p.status.toUpperCase()}</Badge></td>
                        </tr>
                      ))}
                      {displayedPayouts.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-gray-500">Geçmiş işlem bulunmuyor.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold mb-6 text-gray-900">Mağaza Ayarları</h2>
                <form className="space-y-5" onSubmit={handleUpdateProfile}>
                  <div className="w-full mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Mağaza / Çiftlik Fotoğrafını Güncelle</label>
                    <input type="file" name="avatar" accept="image/*" className={fileInputClasses} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Sahibi" name="name" defaultValue={currentUser?.name} required /><Input label="Telefon" name="phone" defaultValue={currentUser?.phone} required /></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Mağaza Adı" name="farmName" defaultValue={currentUser?.farmName} required /><Input label="IBAN Numarası" name="iban" placeholder="TR..." defaultValue={currentUser?.iban} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="w-full"><label className="block text-sm mb-1">Şehir <span className="text-red-500">*</span></label><select name="city" defaultValue={currentUser?.city} required className="w-full rounded-lg border py-2.5 px-3 bg-white outline-none">{TURKEY_CITIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <Input label="İlçe" name="district" defaultValue={currentUser?.district} required />
                  </div>
                  <Input label="Açık Adres" name="adress" type="textarea" rows="3" defaultValue={currentUser?.adress || currentUser?.adress} required />
                  <Button type="submit" isLoading={isUpdating} className="w-full py-3.5 text-lg shadow-lg">Değişiklikleri Kaydet</Button>
                </form>
              </div>
            )}
          </>
        )}

        {/* Ürün Ekleme/Düzenleme Modalı */}
        {showProductModal && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
               <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold">{editProduct ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}</h3><button onClick={() => {setShowProductModal(false); setEditProduct(null);}}><X className="text-gray-500 hover:text-red-500" /></button></div>
               <form onSubmit={handleAddOrUpdateProduct} className="space-y-4">
                 <Input label="Ürün Adı" name="name" defaultValue={editProduct?.name} required />
                 <Input label="Açıklama" name="description" type="textarea" rows="2" defaultValue={editProduct?.description} />
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <Input label="Fiyat (₺)" name="price" type="number" step="0.01" defaultValue={editProduct?.price} required />
                     <p className="text-[10px] text-gray-500 -mt-3 ml-1">* Satıştan %5 komisyon kesilir.</p>
                   </div>
                   <div className="w-full"><label className="block text-sm mb-1">Birim *</label><select name="unit" defaultValue={editProduct?.unit} required className="w-full rounded-lg border py-2.5 px-3"><option value="kg">Kg</option><option value="adet">Adet</option><option value="bağ">Bağ</option><option value="kasa">Kasa</option></select></div>
                 </div>
                 <Input label="Stok" name="stock" type="number" defaultValue={editProduct?.stock} required />
                 <div className="w-full border p-4 rounded-xl">
                   <label className="block text-sm font-bold mb-2">Teslimat *</label>
                   <div className="flex gap-4"><label><input type="checkbox" name="opt_kargo" value="1" defaultChecked={editProduct ? editProduct.deliveryOpts?.includes('kargo') : true} className="mr-1"/>Kargo</label><label><input type="checkbox" name="opt_gelal" value="1" defaultChecked={editProduct?.deliveryOpts?.includes('gel_al')} className="mr-1"/>Gel Al</label></div>
                 </div>
                 <div className="w-full">
                   <label className="block text-sm font-bold text-gray-700 mb-2">Ürün Görseli {!editProduct && <span className="text-red-500">*</span>}</label>
                   <input type="file" name="image" accept="image/*" required={!editProduct} className={fileInputClasses} />
                 </div>
                 <Button type="submit" isLoading={isUpdating} className="w-full mt-4">{editProduct ? 'Güncelle' : 'Kaydet ve Yayınla'}</Button>
               </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminPanel = ({ currentUser, showToast }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [allUsers, setAllUsers] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [allReviews, setAllReviews] = useState([]);
  const [allPayouts, setAllPayouts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [dateFilter, setDateFilter] = useState('all');
  const [filterCity, setFilterCity] = useState('');
  const [filterFarmerId, setFilterFarmerId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');
  
  const [confirmData, setConfirmData] = useState({ isOpen: false, type: null, data: null });
  
  const isModerator = currentUser?.role === 'moderator';

  const fetchData = async () => {
    try {
      const [u, o, r, al, pay] = await Promise.all([
        pb.collection('users').getFullList({ sort: '-created' }),
        pb.collection('orders').getFullList({ expand: 'farmer,buyer,product', sort: '-created' }),
        pb.collection('reviews').getFullList({ expand: 'farmer,buyer', sort: '-created' }),
        pb.collection('moderator_logs').getFullList({ expand: 'moderator', sort: '-created' }).catch(()=>[]),
        pb.collection('payouts').getFullList({ expand: 'farmer', sort: '-created' }).catch(()=>[])
      ]);
      const { orders } = await checkAndAutoDeliverOrders(o);
      setAllUsers(u); setAllOrders(orders); setAllReviews(r); setAuditLogs(al); setAllPayouts(pay);
    } catch (error) {} finally { setIsLoading(false); }
  };

  useEffect(() => {
    let isMounted = true;
    fetchData();

    const handleRealtime = () => { if(isMounted) fetchData(); };
    pb.collection('users').subscribe('*', handleRealtime);
    pb.collection('orders').subscribe('*', handleRealtime);
    pb.collection('reviews').subscribe('*', handleRealtime);
    pb.collection('payouts').subscribe('*', handleRealtime);
    if (!isModerator) pb.collection('moderator_logs').subscribe('*', handleRealtime);

    return () => {
      isMounted = false;
      pb.collection('users').unsubscribe('*', handleRealtime);
      pb.collection('orders').unsubscribe('*', handleRealtime);
      pb.collection('reviews').unsubscribe('*', handleRealtime);
      pb.collection('payouts').unsubscribe('*', handleRealtime);
      if (!isModerator) pb.collection('moderator_logs').unsubscribe('*', handleRealtime);
    };
  }, [currentUser]);

  const handleConfirmAction = async () => {
    const { type, data } = confirmData;
    setConfirmData({ isOpen: false, type: null, data: null });

    if (type === 'approve_store') {
      try {
        await pb.collection('users').update(data.id, { is_verified: true });
        await logModeratorAction(currentUser, "Mağaza Onaylandı", `Mağaza: ${data.farmName}`);
        setAllUsers(allUsers.map(u => u.id === data.id ? {...u, is_verified: true} : u));
        showToast('Mağaza onaylandı.', 'success');
      } catch(e) { showToast('Hata oluştu.', 'error'); console.error(e); }
    } 
    else if (type === 'delete_user') {
      try {
        await pb.collection('users').delete(data.id);
        const logDetail = data.role === 'farmer' ? `Mağaza Silindi: ${data.farmName} (${data.name})` : `Müşteri Silindi: ${data.name} (${data.email})`;
        await logModeratorAction(currentUser, "Hesap Silindi", logDetail);
        setAllUsers(allUsers.filter(u => u.id !== data.id));
        showToast('Kullanıcı başarıyla silindi.', 'success');
      } catch(e) { showToast('Kullanıcı silinemedi.', 'error'); console.error(e); }
    }
    else if (type === 'delete_review') {
      try {
        const review = data; const farmer = review.expand?.farmer;
        if(farmer) {
          const newCount = Math.max(0, farmer.reviewCount - 1);
          const newRating = newCount === 0 ? 0 : ((farmer.rating * farmer.reviewCount) - review.rating) / newCount;
          try { await pb.collection('users').update(farmer.id, { reviewCount: newCount, rating: newRating }); } catch(err) { console.error("Review count update fail", err); }
        }
        await pb.collection('reviews').delete(review.id);
        await logModeratorAction(currentUser, "Yorum Silindi", `Satıcı: ${farmer?.farmName}, Puan: ${review.rating}`);
        setAllReviews(allReviews.filter(r => r.id !== review.id));
        showToast('Yorum kaldırıldı.', 'success');
      } catch(e) { showToast('Yorum silinemedi. PocketBase API izinlerini kontrol edin.', 'error'); console.error(e); }
    }
    else if (type === 'refund_order') {
      try {
        const order = data;
        await pb.collection('orders').update(order.id, { status: 'İade Edildi' });
        const product = order.expand?.product;
        if(product) {
           try { await pb.collection('products').update(product.id, { stock: product.stock + order.quantity }); } catch(err){ console.error("Stok update fail", err); }
        }
        await logModeratorAction(currentUser, "Sipariş İade Edildi", `Sipariş ID: ${order.id}, Tutar: ${order.total}₺`);
        setAllOrders(allOrders.map(o => o.id === order.id ? {...o, status: 'İade Edildi'} : o));
        showToast('Sipariş iade edildi ve stok geri eklendi.', 'success');
      } catch(e) { showToast('İade işlemi başarısız. PocketBase API izinlerini kontrol edin.', 'error'); console.error(e); }
    }
    else if (type === 'approve_payout') {
      try {
        await pb.collection('payouts').update(data.id, { status: 'odendi' });
        await logModeratorAction(currentUser, "Ödeme Yapıldı", `Tutar: ${data.amount}₺, IBAN: ${data.iban}`);
        setAllPayouts(allPayouts.map(p => p.id === data.id ? {...p, status: 'odendi'} : p));
        showToast('Ödeme tamamlandı olarak işaretlendi.', 'success');
      } catch(e) { showToast('İşlem başarısız.', 'error'); console.error(e); }
    }
    else if (type === 'reject_payout') {
      try {
        await pb.collection('payouts').update(data.id, { status: 'reddedildi' });
        await logModeratorAction(currentUser, "Ödeme Reddedildi", `Tutar: ${data.amount}₺, IBAN: ${data.iban}`);
        setAllPayouts(allPayouts.map(p => p.id === data.id ? {...p, status: 'reddedildi'} : p));
        showToast('Ödeme talebi reddedildi.', 'success');
      } catch(e) { showToast('İşlem başarısız.', 'error'); console.error(e); }
    }
  };

  const advFilter = (record, type) => {
    const farmerUser = type === 'order' ? record.expand?.farmer : type === 'payout' ? record.expand?.farmer : type === 'review' ? record.expand?.farmer : null;
    if (filterCity && farmerUser?.city !== filterCity) return false;
    if (filterFarmerId && farmerUser?.id !== filterFarmerId) return false;
    return true;
  }

  const displayedOrders = filterByDate(allOrders, dateFilter).filter(o => advFilter(o, 'order'));
  const displayedPayouts = filterByDate(allPayouts, dateFilter).filter(p => advFilter(p, 'payout'));
  const displayedReviews = filterByDate(allReviews, dateFilter).filter(r => advFilter(r, 'review'));
  
  const displayedLogs = filterByDate(auditLogs, dateFilter).filter(l => {
    if(!logSearch) return true;
    return (l.expand?.moderator?.name || '').toLowerCase().includes(logSearch.toLowerCase());
  });

  const filteredUsers = allUsers.filter(u => {
     if(!userSearch) return true;
     const s = userSearch.toLowerCase();
     return (u.name && u.name.toLowerCase().includes(s)) || 
            (u.email && u.email.toLowerCase().includes(s)) || 
            (u.phone && u.phone.includes(s)) ||
            (u.farmName && u.farmName.toLowerCase().includes(s));
  });

  const pendingUsers = filteredUsers.filter(u => u.role === 'farmer' && !u.is_verified);
  const verifiedUsers = filteredUsers.filter(u => u.role === 'farmer' && u.is_verified);
  const buyersList = filteredUsers.filter(u => u.role === 'buyer');
  const farmersInCity = allUsers.filter(u => u.role === 'farmer' && u.city === filterCity);

  const calcAdminStats = () => {
    const today = new Date();
    const last7Days = Array(7).fill(0).map((_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - i);
      return { label: d.toLocaleDateString('tr-TR', { weekday: 'short' }), dateStr: d.toISOString().split('T')[0], value: 0 };
    }).reverse();

    displayedOrders.filter(o => o.status !== 'İptal' && o.status !== 'İade Edildi').forEach(o => {
      try {
        if (!o.created) return;
        const dateStr = new Date(o.created).toISOString().split('T')[0];
        const dayObj = last7Days.find(d => d.dateStr === dateStr);
        if (dayObj) dayObj.value += (o.total || 0);
      } catch(e) {}
    });
    return { last7Days };
  };

  const FilterBar = () => (
    <div className="flex flex-wrap gap-2 w-full md:w-auto">
      <select className="border border-gray-300 rounded-lg py-2 px-3 text-sm font-medium outline-none" value={filterCity} onChange={e => { setFilterCity(e.target.value); setFilterFarmerId(''); }}>
         <option value="">Tüm İller</option>
         {TURKEY_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <select className="border border-gray-300 rounded-lg py-2 px-3 text-sm font-medium outline-none" value={filterFarmerId} onChange={e => setFilterFarmerId(e.target.value)} disabled={!filterCity}>
         <option value="">Tüm Mağazalar</option>
         {farmersInCity.map(f => <option key={f.id} value={f.id}>{f.farmName}</option>)}
      </select>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 flex flex-col md:flex-row gap-8 animate-in fade-in">
      
      <UIConfirmModal 
        isOpen={confirmData.isOpen} 
        title={confirmData.type === 'reject_payout' ? "Talebi Reddet" : confirmData.type === 'delete_user' ? "Kullanıcıyı Sil" : "Emin misiniz?"} 
        message={
          confirmData.type === 'reject_payout' ? "Bu para çekme talebini reddetmek istediğinize emin misiniz?" : 
          confirmData.type === 'delete_user' ? `Bu hesabı (${confirmData.data?.name || confirmData.data?.farmName}) kalıcı olarak silmek istediğinize emin misiniz? İşlem geri alınamaz.` :
          "Bu işlemi gerçekleştirmek istediğinize emin misiniz? İşlem yetki loglarına kaydedilecektir."
        } 
        confirmText={confirmData.type === 'reject_payout' ? "Reddet" : confirmData.type === 'delete_user' ? "Sil" : "Onayla"} 
        isDanger={confirmData.type !== 'approve_store' && confirmData.type !== 'approve_payout'} 
        onCancel={()=>setConfirmData({isOpen:false})} 
        onConfirm={handleConfirmAction} 
      />

      <div className="w-full md:w-72 space-y-3 flex-shrink-0">
        <div className="bg-gray-900 p-6 rounded-2xl border shadow-sm text-center mb-6 text-white">
          <ShieldCheck className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h3 className="font-extrabold text-lg">{currentUser?.name}</h3>
          <p className="text-sm text-green-400 font-bold mt-1 uppercase">{isModerator ? 'Moderatör Paneli' : 'Yönetici Paneli'}</p>
        </div>
        <Button variant={activeTab === 'dashboard' ? 'secondary' : 'outline'} className={`w-full justify-start py-3 ${activeTab !== 'dashboard' && 'border-none'}`} onClick={() => setActiveTab('dashboard')}><BarChart3 className="w-5 h-5"/> Genel Durum</Button>
        <Button variant={activeTab === 'orders' ? 'secondary' : 'outline'} className={`w-full justify-start py-3 ${activeTab !== 'orders' && 'border-none'}`} onClick={() => setActiveTab('orders')}><ListOrdered className="w-5 h-5"/> Tüm Siparişler</Button>
        <Button variant={activeTab === 'users' ? 'secondary' : 'outline'} className={`w-full justify-start py-3 ${activeTab !== 'users' && 'border-none'}`} onClick={() => setActiveTab('users')}><Store className="w-5 h-5"/> Kullanıcı Yönetimi {pendingUsers.length > 0 && <span className="ml-auto bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingUsers.length}</span>}</Button>
        <Button variant={activeTab === 'finance' ? 'secondary' : 'outline'} className={`w-full justify-start py-3 ${activeTab !== 'finance' && 'border-none'}`} onClick={() => setActiveTab('finance')}><CreditCard className="w-5 h-5"/> Muhasebe & Ödemeler {allPayouts.filter(p=>p.status==='bekliyor').length > 0 && <span className="ml-auto bg-red-500 text-white text-xs px-2 rounded-full">{allPayouts.filter(p=>p.status==='bekliyor').length}</span>}</Button>
        <Button variant={activeTab === 'reviews' ? 'secondary' : 'outline'} className={`w-full justify-start py-3 ${activeTab !== 'reviews' && 'border-none'}`} onClick={() => setActiveTab('reviews')}><MessageSquare className="w-5 h-5"/> Yorum Yönetimi</Button>
        {!isModerator && <Button variant={activeTab === 'logs' ? 'secondary' : 'outline'} className={`w-full justify-start py-3 ${activeTab !== 'logs' && 'border-none'}`} onClick={() => setActiveTab('logs')}><History className="w-5 h-5"/> Moderatör Geçmişi</Button>}
      </div>

      <div className="flex-1 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm min-h-[600px]">
        {isLoading ? <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-green-600" /></div> : (
          <>
            {activeTab === 'dashboard' && (
              <div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
                  <h2 className="text-2xl font-bold text-gray-900">Platform Satışları</h2>
                  <div className="flex flex-wrap gap-2">
                    <FilterBar />
                    <select className="border border-gray-300 rounded-lg py-2 px-3 text-sm font-medium outline-none" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}>
                      <option value="all">Tüm Zamanlar</option><option value="daily">Bugün</option><option value="weekly">Bu Hafta</option><option value="monthly">Bu Ay</option><option value="yearly">Bu Yıl</option>
                    </select>
                    <Button variant="outline" onClick={() => {
                      const exportData = displayedOrders.map(o => ({
                        "Sipariş No": o.id,
                        "Tarih": new Date(o.created).toLocaleDateString('tr-TR'),
                        "Müşteri": o.expand?.buyer?.name || '-',
                        "Mağaza": o.expand?.farmer?.farmName || '-',
                        "Ürün": o.expand?.product?.name || '-',
                        "Miktar": o.quantity,
                        "Birim": o.expand?.product?.unit || '-',
                        "Tutar (TL)": o.total,
                        "Durum": o.status
                      }));
                      exportToCSV(exportData, {}, 'platform_satislar.csv');
                    }}><Download className="w-4 h-4 mr-2"/> Excel</Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-8">
                   <div className="bg-green-50 p-6 rounded-xl border border-green-100"><p className="text-sm font-bold mb-1">Satış Hacmi</p><p className="text-3xl font-black text-green-800">{displayedOrders.filter(o=>o.status!=='İptal' && o.status!=='İade Edildi').reduce((acc, o)=>acc+o.total, 0)}₺</p></div>
                   <div className="bg-blue-50 p-6 rounded-xl border border-blue-100"><p className="text-sm font-bold mb-1">Onaylı Mağaza</p><p className="text-3xl font-black text-blue-800">{allUsers.filter(u=>u.role==='farmer' && u.is_verified).length}</p></div>
                   <div className="bg-purple-50 p-6 rounded-xl border border-purple-100"><p className="text-sm font-bold mb-1">Sipariş Sayısı</p><p className="text-3xl font-black text-purple-800">{displayedOrders.length}</p></div>
                </div>
                <SimpleBarChart data={calcAdminStats().last7Days} title="Filtrelenen Son 7 Günlük Satışlar (₺)" color="bg-indigo-500" />
              </div>
            )}

            {activeTab === 'orders' && (
              <div>
                <div className="flex flex-col xl:flex-row justify-between xl:items-center mb-6 gap-4">
                  <h2 className="text-2xl font-bold">Siparişler ve İadeler</h2>
                  <div className="flex flex-wrap gap-2">
                    <FilterBar />
                    <select className="border border-gray-300 rounded-lg py-2 px-3 text-sm font-medium outline-none" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}>
                      <option value="all">Tüm Zamanlar</option><option value="daily">Bugün</option><option value="weekly">Bu Hafta</option><option value="monthly">Bu Ay</option><option value="yearly">Bu Yıl</option>
                    </select>
                    <Button variant="outline" onClick={() => {
                      const exportData = displayedOrders.map(o => ({
                         "Sipariş No": o.id,
                         "Tarih": new Date(o.created).toLocaleDateString('tr-TR'),
                         "Müşteri": o.expand?.buyer?.name || '-',
                         "Mağaza": o.expand?.farmer?.farmName || '-',
                         "Ürün": o.expand?.product?.name || '-',
                         "Miktar": o.quantity,
                         "Birim": o.expand?.product?.unit || '-',
                         "Tutar (TL)": o.total,
                         "Kargo Firması": o.cargoCompany || '-',
                         "Takip No": o.trackingNumber || '-',
                         "Durum": o.status
                      }));
                      exportToCSV(exportData, {}, 'tum_siparisler.csv');
                    }}><Download className="w-4 h-4 mr-2"/> Excel İndir</Button>
                  </div>
                </div>
                <div className="space-y-4">
                  {displayedOrders.map(order => {
                     const product = order.expand?.product || { name: 'Silinmiş', unit: '' };
                     const buyer = order.expand?.buyer || { name: 'Bilinmeyen' };
                     const farmer = order.expand?.farmer || { farmName: 'Bilinmeyen' };
                     return (
                      <div key={order.id} className="border border-gray-200 rounded-xl p-5 bg-gray-50/30 text-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                         <div className="flex-1 w-full">
                           <div className="font-bold text-gray-900 mb-1">{product.name} ({order.quantity} {product.unit})</div>
                           <div className="text-gray-600">Alıcı: {buyer.name} | Satıcı: {farmer.farmName}</div>
                           <div className="font-black text-green-700 mt-1">{order.total}₺</div>
                           {order.trackingNumber && <div className="text-blue-600 text-xs font-medium mt-1">Kargo: {order.cargoCompany} - Takip: {order.trackingNumber}</div>}
                         </div>
                         <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                           <Badge type={order.status === 'İptal' || order.status === 'İade Edildi' ? 'error' : (order.status==='Teslim Edildi'?'success':'warning')}>{order.status}</Badge>
                           {order.status !== 'İade Edildi' && order.status !== 'İptal' && <Button variant="danger" size="sm" onClick={()=>setConfirmData({isOpen:true, type:'refund_order', data:order})}>İade Et</Button>}
                         </div>
                      </div>
                     )
                  })}
                  {displayedOrders.length === 0 && <p className="text-gray-500 py-8 text-center bg-gray-50 rounded-xl border border-dashed">Kayıt bulunmuyor.</p>}
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                  <h2 className="text-2xl font-bold text-gray-900">Kullanıcı Yönetimi</h2>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input type="text" placeholder="İsim, Tel, E-posta ara..." className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-green-500" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                  </div>
                </div>
                
                {pendingUsers.length > 0 && (
                  <div className="mb-8">
                    <h3 className="font-bold text-lg text-yellow-600 mb-4 border-b border-yellow-200 pb-2">Onay Bekleyen Mağazalar</h3>
                    <div className="space-y-4">
                      {pendingUsers.map(user => (
                        <div key={user.id} className="border border-yellow-200 rounded-xl p-5 flex flex-col sm:flex-row justify-between sm:items-center bg-yellow-50/30 gap-4">
                          <div>
                            <p className="font-bold text-gray-900 text-lg mb-1">{user.farmName} <Badge type="warning">Onay Bekliyor</Badge></p>
                            <p className="text-sm text-gray-600">Sahibi: {user.name} | Tel: {user.phone}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => setConfirmData({isOpen:true, type:'approve_store', data:user})}><CheckCircle className="w-4 h-4 mr-1"/> Onayla</Button>
                            <Button variant="danger" size="sm" onClick={() => setConfirmData({isOpen:true, type:'delete_user', data:user})}><Ban className="w-4 h-4 mr-1"/> Sil</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="font-bold text-lg text-gray-800 mb-4 border-b border-gray-200 pb-2">Onaylı Mağazalar</h3>
                  <div className="space-y-4">
                    {verifiedUsers.map(user => (
                      <div key={user.id} className="border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row justify-between sm:items-center bg-gray-50/50 gap-4">
                        <div>
                          <p className="font-bold text-gray-900 text-lg mb-1">{user.farmName} <Badge type="success">Onaylı Mağaza</Badge></p>
                          <p className="text-sm text-gray-600">Sahibi: {user.name} | Tel: {user.phone} | E-Posta: {user.email}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="danger" size="sm" onClick={() => setConfirmData({isOpen:true, type:'delete_user', data:user})}><Ban className="w-4 h-4 mr-1"/> Sil</Button>
                        </div>
                      </div>
                    ))}
                    {verifiedUsers.length === 0 && <p className="text-gray-500">Kayıt bulunmuyor.</p>}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-lg text-gray-800 mb-4 border-b border-gray-200 pb-2">Tüm Müşteriler</h3>
                  <div className="space-y-4">
                    {buyersList.map(user => (
                      <div key={user.id} className="border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row justify-between sm:items-center bg-gray-50/50 gap-4">
                        <div>
                          <p className="font-bold text-gray-900 text-lg mb-1">{user.name} <Badge>Müşteri</Badge></p>
                          <p className="text-sm text-gray-600">E-Posta: {user.email} | Tel: {user.phone}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="danger" size="sm" onClick={() => setConfirmData({isOpen:true, type:'delete_user', data:user})}><Ban className="w-4 h-4 mr-1"/> Hesabı Sil</Button>
                        </div>
                      </div>
                    ))}
                    {buyersList.length === 0 && <p className="text-gray-500">Kayıt bulunmuyor.</p>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'finance' && (
              <div>
                <div className="flex flex-col xl:flex-row justify-between xl:items-center mb-6 gap-4">
                  <h2 className="text-2xl font-bold text-gray-900">Muhasebe Talepleri</h2>
                  <div className="flex flex-wrap gap-2">
                    <FilterBar />
                    <select className="border border-gray-300 rounded-lg py-2 px-3 text-sm font-medium outline-none" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}>
                      <option value="all">Tüm Zamanlar</option><option value="daily">Bugün</option><option value="weekly">Bu Hafta</option><option value="monthly">Bu Ay</option><option value="yearly">Bu Yıl</option>
                    </select>
                    <Button variant="outline" onClick={() => {
                      const exportData = displayedPayouts.map(p => ({
                        "Tarih": new Date(p.created).toLocaleDateString('tr-TR'),
                        "Mağaza": p.expand?.farmer?.farmName || '-',
                        "Mağaza Sahibi": p.expand?.farmer?.name || '-',
                        "Miktar (TL)": p.amount,
                        "IBAN": p.iban,
                        "Durum": p.status
                      }));
                      exportToCSV(exportData, {}, 'muhasebe_talepleri.csv');
                    }}><Download className="w-4 h-4 mr-2"/> Excel İndir</Button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-xs">
                      <tr><th className="p-4">Mağaza & Sahibi</th><th className="p-4">Tarih</th><th className="p-4">Tutar</th><th className="p-4">IBAN</th><th className="p-4">Durum</th><th className="p-4 text-right">İşlem</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                       {displayedPayouts.map(p => (
                         <tr key={p.id} className="hover:bg-gray-50">
                           <td className="p-4">
                             <div className="font-bold text-gray-900">{p.expand?.farmer?.farmName}</div>
                             <div className="text-xs text-gray-500">{p.expand?.farmer?.name}</div>
                           </td>
                           <td className="p-4 text-gray-500">{new Date(p.created).toLocaleDateString('tr-TR')}</td>
                           <td className="p-4 font-bold text-green-700">{p.amount}₺</td>
                           <td className="p-4 font-mono text-xs text-gray-500">{p.iban}</td>
                           <td className="p-4"><Badge type={p.status === 'odendi' ? 'success' : (p.status === 'reddedildi' ? 'error' : 'warning')}>{p.status}</Badge></td>
                           <td className="p-4 text-right">
                             {p.status === 'bekliyor' && (
                               <div className="flex gap-2 justify-end">
                                 <Button variant="danger" size="sm" onClick={()=>setConfirmData({isOpen:true, type:'reject_payout', data:p})}>Reddet</Button>
                                 <Button size="sm" onClick={()=>setConfirmData({isOpen:true, type:'approve_payout', data:p})}>Ödendi Yap</Button>
                               </div>
                             )}
                           </td>
                         </tr>
                       ))}
                       {displayedPayouts.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-500">Talep bulunamadı.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div>
                <div className="flex flex-col xl:flex-row justify-between xl:items-center mb-6 gap-4">
                  <h2 className="text-2xl font-bold">Tüm Yorumlar</h2>
                  <div className="flex flex-wrap gap-2">
                    <FilterBar />
                    <select className="border border-gray-300 rounded-lg py-2 px-3 text-sm font-medium outline-none" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}>
                      <option value="all">Tüm Zamanlar</option><option value="daily">Bugün</option><option value="weekly">Bu Hafta</option><option value="monthly">Bu Ay</option><option value="yearly">Bu Yıl</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-4">
                  {displayedReviews.map(r => (
                    <div key={r.id} className="border border-gray-200 rounded-xl p-5">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm font-bold text-gray-900">Müşteri: {r.expand?.buyer?.name} <span className="text-gray-400 font-normal">→ Satıcı: {r.expand?.farmer?.farmName}</span></p>
                          <div className="flex text-yellow-400 my-1">{[...Array(5)].map((_, i) => <Star key={i} className={`w-3 h-3 ${i < r.rating ? 'fill-current' : 'text-gray-200'}`} />)}</div>
                        </div>
                        <Button variant="danger" size="sm" onClick={() => setConfirmData({isOpen:true, type:'delete_review', data:r})}><Trash2 className="w-4 h-4"/></Button>
                      </div>
                      <p className="text-gray-700 text-sm">{r.comment}</p>
                    </div>
                  ))}
                  {displayedReviews.length === 0 && <p className="text-gray-500 py-8 text-center bg-gray-50 rounded-xl border border-dashed">Kayıt bulunmuyor.</p>}
                </div>
              </div>
            )}

            {activeTab === 'logs' && !isModerator && (
              <div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                  <h2 className="text-2xl font-bold">Moderatör İşlem Geçmişi</h2>
                  <div className="flex gap-2">
                    <div className="relative w-full sm:w-56">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input type="text" placeholder="Moderatör ara..." value={logSearch} onChange={e=>setLogSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-green-500" />
                    </div>
                    <select className="border border-gray-300 rounded-lg py-2 px-3 text-sm font-medium outline-none" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}>
                      <option value="all">Tüm Zamanlar</option><option value="daily">Bugün</option><option value="weekly">Bu Hafta</option><option value="monthly">Bu Ay</option>
                    </select>
                    <Button variant="outline" onClick={() => {
                      const exportData = displayedLogs.map(l => ({
                         "Tarih": new Date(l.created).toLocaleDateString('tr-TR'),
                         "Moderatör": l.expand?.moderator?.name || '-',
                         "İşlem": l.action,
                         "Detaylar": l.details
                      }));
                      exportToCSV(exportData, {}, 'loglar.csv');
                    }}><Download className="w-4 h-4 mr-2"/> Excel İndir</Button>
                  </div>
                </div>
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-xs">
                      <tr><th className="p-4">Tarih</th><th className="p-4">Moderatör</th><th className="p-4">İşlem</th><th className="p-4">Detaylar</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                       {displayedLogs.map(l => (
                         <tr key={l.id} className="hover:bg-gray-50">
                           <td className="p-4 whitespace-nowrap">{new Date(l.created).toLocaleDateString('tr-TR')}</td>
                           <td className="p-4 font-bold">{l.expand?.moderator?.name || 'Bilinmiyor'}</td>
                           <td className="p-4 text-red-600 font-medium">{l.action}</td>
                           <td className="p-4 text-gray-600">{l.details}</td>
                         </tr>
                       ))}
                       {displayedLogs.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-gray-500">Log kaydı bulunamadı.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- ANA APP WRAPPER ---
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('home'); 
  const [selectedFarmerId, setSelectedFarmerId] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [registerRoleParam, setRegisterRoleParam] = useState('buyer'); 
  const [searchParams, setSearchParams] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  // 1. Yetki verilerini dinle
  useEffect(() => {
    setCurrentUser(pb.authStore.model);
    const unsubscribeAuth = pb.authStore.onChange((token, model) => setCurrentUser(model));
    return () => unsubscribeAuth();
  }, []);

  // 2. Kullanıcı verisini gerçek zamanlı (realtime) güncelle (Onaylanma vs. için)
  useEffect(() => {
    let isMounted = true;
    if (currentUser?.id) {
      pb.collection('users').subscribe(currentUser.id, function (e) {
        if (e.action === 'update' && isMounted) {
          if (pb.authStore.model?.id === currentUser.id) {
             pb.authStore.save(pb.authStore.token, e.record);
             setCurrentUser(e.record);
          }
        }
      }).catch(()=>{});
    }
    return () => {
      isMounted = false;
      if (currentUser?.id) {
         pb.collection('users').unsubscribe(currentUser.id).catch(()=>{});
      }
    };
  }, [currentUser?.id]);

  const navigate = (view, params = {}, pushToHistory = true) => {
    setCurrentView(view);
    setSelectedFarmerId(params.farmerId || null);
    setRegisterRoleParam(params.role || 'buyer');
    setSearchParams(params.searchParams || null);
    window.scrollTo(0, 0);
    setIsMobileMenuOpen(false);

    if (pushToHistory) {
      window.history.pushState({ view, params }, '', `?view=${view}`);
    }
  };

  useEffect(() => {
    const handlePopState = (e) => {
      if (e.state && e.state.view) {
        navigate(e.state.view, e.state.params || {}, false);
      } else {
        navigate('home', {}, false);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    window.history.replaceState({ view: 'home', params: {} }, '', '?view=home');
    
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogout = () => {
    pb.authStore.clear(); 
    setCurrentUser(null); // EKLENDİ: Arayüzün anında çıkış yapılmış haline dönmesi için
    setLogoutConfirm(false); 
    navigate('home');
    showToast('Başarıyla çıkış yapıldı.', 'info');
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3500);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 relative">
      
      <UIConfirmModal isOpen={logoutConfirm} title="Çıkış Yap" message="Hesabınızdan çıkış yapmak istediğinize emin misiniz?" confirmText="Çıkış Yap" isDanger={true} onCancel={()=>setLogoutConfirm(false)} onConfirm={handleLogout} />

      {toast.show && (
        <div className={`fixed top-24 right-4 sm:right-8 p-4 rounded-xl shadow-2xl z-[200] flex items-center gap-3 animate-in slide-in-from-right font-medium text-white ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'info' ? 'bg-blue-600' : 'bg-green-600'}`}>
          {toast.type === 'error' ? <X className="w-5 h-5"/> : <CheckCircle className="w-5 h-5"/>}
          {toast.message}
        </div>
      )}

      {/* Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('home')}>
              <div className="bg-green-600 p-2.5 rounded-xl group-hover:bg-green-700 transition-colors shadow-sm"><Leaf className="h-6 w-6 text-white" /></div>
              <span className="text-2xl font-extrabold text-green-700 tracking-tight">Tarladan.</span>
            </div>

            <div className="hidden md:flex items-center gap-4">
              {currentUser ? (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-extrabold leading-none text-gray-900">{currentUser.name}</p>
                    <p className="text-xs text-green-600 font-bold mt-1 uppercase tracking-wide">{currentUser.role === 'farmer' ? 'Mağaza' : (currentUser.role === 'admin' || currentUser.role === 'moderator' ? 'Yönetici' : 'Müşteri')}</p>
                  </div>
                  {currentUser.role === 'buyer' ? (
                    <button onClick={() => navigate('buyerPanel')} className="w-10 h-10 bg-green-100 text-green-700 hover:bg-green-200 rounded-full flex items-center justify-center transition-colors shadow-sm" title="Profilim">
                       <User className="w-5 h-5" />
                    </button>
                  ) : (
                    <Button onClick={() => navigate((currentUser.role === 'admin' || currentUser.role === 'moderator') ? 'adminPanel' : 'sellerPanel')} className="rounded-xl px-5 shadow-sm bg-gray-900 hover:bg-black">Panelim</Button>
                  )}
                  <button onClick={()=>setLogoutConfirm(true)} className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" title="Çıkış Yap"><LogOut className="w-5 h-5" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Button variant="outline" className="border-gray-200 rounded-xl" onClick={() => navigate('login')}>Giriş Yap</Button>
                  <Button className="rounded-xl shadow-sm" onClick={() => navigate('register', { role: 'buyer' })}>Üye Ol</Button>
                </div>
              )}
            </div>
            <div className="md:hidden">
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-600">
                {isMobileMenuOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
              </button>
            </div>
          </div>
        </div>
        {/* Mobil Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 pt-4 pb-6 space-y-2 absolute w-full shadow-2xl z-40">
            {currentUser ? (
              <>
                {currentUser.role === 'buyer' ? (
                  <button className="w-full text-left py-3.5 px-4 font-bold text-white bg-green-600 rounded-xl flex items-center gap-2" onClick={() => navigate('buyerPanel')}><User className="w-5 h-5"/> Profilim ({currentUser.name})</button>
                ) : (
                  <button className="w-full text-left py-3.5 px-4 font-bold text-white bg-gray-900 rounded-xl" onClick={() => navigate((currentUser.role === 'admin' || currentUser.role === 'moderator') ? 'adminPanel' : 'sellerPanel')}>Panelim ({currentUser.name})</button>
                )}
                <button className="w-full text-left py-3.5 px-4 font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 mt-2" onClick={()=>setLogoutConfirm(true)}><LogOut className="w-5 h-5"/> Çıkış Yap</button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3 mt-2 px-2">
                <Button variant="outline" onClick={() => navigate('login')} className="py-3">Giriş Yap</Button>
                <Button onClick={() => navigate('register', { role: 'buyer' })} className="py-3">Üye Ol</Button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-grow">
        {currentView === 'home' && <HomeView navigate={navigate} currentUser={currentUser} />}
        {currentView === 'search' && <SearchView navigate={navigate} searchParams={searchParams} />}
        {currentView === 'store' && <StoreView navigate={navigate} selectedFarmerId={selectedFarmerId} currentUser={currentUser} showToast={showToast} />}
        {currentView === 'login' && <LoginRegisterView navigate={navigate} isLogin={true} showToast={showToast} />}
        {currentView === 'register' && <LoginRegisterView navigate={navigate} isLogin={false} registerRoleParam={registerRoleParam} showToast={showToast} />}
        {currentView === 'buyerPanel' && <BuyerPanel currentUser={currentUser} setCurrentUser={setCurrentUser} showToast={showToast} />}
        {currentView === 'sellerPanel' && <SellerPanel currentUser={currentUser} setCurrentUser={setCurrentUser} showToast={showToast} />}
        {currentView === 'adminPanel' && <AdminPanel currentUser={currentUser} showToast={showToast} />}
        {currentView === 'about' && <AboutView />}
        {currentView === 'terms' && <TermsView />}
        {currentView === 'privacy' && <PrivacyView />}
        {currentView === 'faq' && <FaqView />}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-16 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-2 mb-6">
                <Leaf className="h-8 w-8 text-green-500" />
                <span className="text-3xl font-extrabold text-white tracking-tight">Tarladan.</span>
              </div>
              <p className="text-sm text-gray-400 mb-8 leading-relaxed">
                Tarladan, yerel çiftçilerin doğal ürünlerini doğrudan tüketicilere ulaştırmasını sağlayan yeni nesil, şeffaf ve güvenilir bir pazar yeridir.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-6 uppercase text-sm tracking-widest border-b border-gray-800 pb-2 inline-block">Hızlı Linkler</h4>
              <ul className="space-y-3 text-sm font-medium">
                <li><button onClick={() => navigate('home')} className="hover:text-green-400 transition-colors">Ana Sayfa</button></li>
                <li><button onClick={() => navigate('faq')} className="hover:text-green-400 transition-colors">Sıkça Sorulan Sorular</button></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 uppercase text-sm tracking-widest border-b border-gray-800 pb-2 inline-block">Kurumsal</h4>
              <ul className="space-y-3 text-sm font-medium">
                <li><button onClick={() => navigate('about')} className="hover:text-green-400 transition-colors">Hakkımızda</button></li>
                <li><button onClick={() => navigate('terms')} className="hover:text-green-400 transition-colors">Kullanıcı Sözleşmesi</button></li>
                <li><button onClick={() => navigate('privacy')} className="hover:text-green-400 transition-colors">Gizlilik Politikası</button></li>
              </ul>
            </div>

            <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 col-span-1 md:col-span-2 md:col-start-3 lg:col-span-1">
              <h4 className="text-white font-bold mb-3 text-lg flex items-center gap-2">
                <Store className="w-5 h-5 text-green-500" /> Çiftçi Olmak İster Misiniz?
              </h4>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">Ürünlerinizi tüm Türkiye'ye aracısız satmak için ücretsiz mağazanızı hemen açın!</p>
              <Button onClick={() => navigate('register', { role: 'farmer' })} className="w-full shadow-lg sm:w-auto">Hemen Başvur</Button>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-500 font-medium">&copy; {new Date().getFullYear()} Tarladan Bilişim Teknolojileri A.Ş. Tüm hakları saklıdır.</p>
            <div className="flex gap-4 text-sm text-gray-500 font-medium">
               %100 Güvenli Alışveriş • SSL Sertifikalı Altyapı
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
