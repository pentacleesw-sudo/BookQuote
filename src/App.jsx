/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  BookOpen, 
  Layers, 
  Settings, 
  Truck, 
  User, 
  Plus, 
  Trash2, 
  ChevronRight,
  Calculator,
  CheckCircle2,
  Info,
  Copy,
  Edit2,
  X,
  ChevronDown,
  Save,
  Check,
  List,
  History,
  ExternalLink,
  Search,
  RefreshCw,
  MapPin,
  FileText,
  Calendar,
  Download,
  Package,
  Clock,
  TrendingUp,
  PieChart as PieChartIcon
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  SIZES, 
  COVER_PAPERS, 
  INNER_PAPERS, 
  BINDING_TYPES, 
  COATING_TYPES,
  PRINTING_TYPES,
  ENDPAPER_TYPES,
  FOIL_TYPES,
  COVER_PAPER_WEIGHTS,
  DEFAULT_PRICE_CONFIG
} from './constants';
import { INITIAL_SEED_ORDERS } from './data/initialOrders';

const INITIAL_STATE = {
  orderName: '',
  size: '46판',
  customSize: { width: 128, height: 188 },
  quantity: 100,
  cover: {
    paper: '스노우',
    customPaper: '',
    weight: '250',
    printing: '단면 4도',
    hasFlaps: false,
    coating: '무광',
  },
  bellyBand: {
    enabled: false,
    paper: '스노우',
    weight: '150',
    printing: '단면 4도',
    coating: '무광',
  },
  jacket: {
    enabled: false,
    paper: '스노우',
    weight: '150',
    printing: '단면 4도',
    coating: '무광',
  },
  innerSections: [
    { id: '1', paper: '백색 모조지', weight: '80g', printing: '1도', pages: 200 }
  ],
  binding: '세로 좌철',
  postProcessing: {
    endpaper: '없음',
    endpaperColor: '',
    endpaperPages: 4,
    epoxy: false,
    foil: '없음',
  },
  companyInfo: {
    code: '',
    publisherName: '',
    contactName: '',
    contactPhone: '',
  },
  delivery: {
    desiredDate: '',
    locations: [
      { id: '1', quantity: 100, address: '', contactName: '', contactPhone: '', method: '택배' }
    ],
    requests: '',
  },
  applyDiscount: false,
};

const calculatePriceBreakdown = (form, priceConfig) => {
  const qty = form.quantity;
  const range = priceConfig.ranges.find(r => qty >= r.min && (r.max === null || qty <= r.max)) || priceConfig.ranges[0];
  const rangeConfig = priceConfig.pricesByRange[range.id];

  // Determine which price to use
  const inputCode = (form.companyInfo.code || '').trim().toLowerCase();
  const separateCompany = priceConfig.separateCompanies.find(c => 
    (c.code || '').trim().toLowerCase() === inputCode
  );
  
  const codePrefix = inputCode.charAt(0);
  let useSpecial = codePrefix === '2' || codePrefix === '3';
  let useSeparate = !!separateCompany;

  if (separateCompany?.priceMode) {
    useSeparate = separateCompany.priceMode === 'separate';
    useSpecial = separateCompany.priceMode === 'special';
  }

  const getExtraCharge = (charge) => {
    if (useSeparate && separateCompany && charge.separate[separateCompany.id] !== undefined) {
      return charge.separate[separateCompany.id];
    }
    return useSpecial ? charge.special : charge.general;
  };

  // 1. Inner sections price
  let innerBase = 0;
  form.innerSections.forEach(section => {
    const sizePrices = rangeConfig.innerPrices[form.size] || rangeConfig.innerPrices['신국판'];
    const prices = sizePrices[section.printing] || sizePrices['1도'];
    let pricePerPage = prices.general;
    if (useSeparate && separateCompany && prices.separate[separateCompany.id] !== undefined) {
      pricePerPage = prices.separate[separateCompany.id];
    } else if (useSpecial) {
      pricePerPage = prices.special;
    }
    innerBase += pricePerPage * section.pages;
  });
  const innerTotal = innerBase * qty;
  const innerDiscount = form.applyDiscount ? Math.round(innerTotal * 0.05) : 0; // 5% discount if checked
  const innerFinal = innerTotal - innerDiscount;

  // 2. Cover price
  const getCoverUnitPrice = (paper, weight) => {
    let unitPrice = rangeConfig.standardCoverPrice.general;
    if (useSeparate && separateCompany && rangeConfig.standardCoverPrice.separate[separateCompany.id] !== undefined) {
      unitPrice = rangeConfig.standardCoverPrice.separate[separateCompany.id];
    } else if (useSpecial) {
      unitPrice = rangeConfig.standardCoverPrice.special;
    }
    const isStandard = (paper === '스노우' || paper === '아트') && weight === '250';
    if (!isStandard) {
      unitPrice += 30;
    }
    return unitPrice;
  };

  const coverUnitPrice = getCoverUnitPrice(form.cover.paper, form.cover.weight);
  const coverTotal = coverUnitPrice * qty;
  const coverDiscount = form.applyDiscount ? Math.round(coverTotal * 0.05) : 0; // 5% discount if checked
  const coverFinal = coverTotal - coverDiscount;

  // 3. Extra charges
  let extras = [];
  
  if (form.cover.printing === '양면 4도') {
    extras.push({ name: '표지 양면인쇄', cost: getExtraCharge(rangeConfig.extraCharges.doubleSidedPrinting) * qty });
  }
  if (form.cover.hasFlaps) {
    extras.push({ name: '표지 날개', cost: getExtraCharge(rangeConfig.extraCharges.flaps) * qty });
  }

  // Belly Band and Jacket
  if (form.bellyBand?.enabled) {
    const bellyBandUnitPrice = getCoverUnitPrice(form.bellyBand.paper, form.bellyBand.weight);
    let bellyBandCost = bellyBandUnitPrice * qty;
    if (form.bellyBand.printing === '양면 4도') {
      bellyBandCost += getExtraCharge(rangeConfig.extraCharges.doubleSidedPrinting) * qty;
    }
    extras.push({ name: '띠지', cost: bellyBandCost });
  }

  if (form.jacket?.enabled) {
    const jacketUnitPrice = getCoverUnitPrice(form.jacket.paper, form.jacket.weight);
    let jacketCost = jacketUnitPrice * qty;
    if (form.jacket.printing === '양면 4도') {
      jacketCost += getExtraCharge(rangeConfig.extraCharges.doubleSidedPrinting) * qty;
    }
    extras.push({ name: '자켓', cost: jacketCost });
  }
  
  let endpaperTotal = 0;
  let endpaperDiscount = 0;
  if (form.postProcessing.endpaper !== '없음') {
    const charge = rangeConfig.extraCharges.endpaper[form.postProcessing.endpaper];
    if (charge) {
      endpaperTotal = getExtraCharge(charge) * (form.postProcessing.endpaperPages || 0) * qty;
      endpaperDiscount = form.applyDiscount ? Math.round(endpaperTotal * 0.5) : 0; // 50% discount if checked
    }
  }
  
  if (form.postProcessing.epoxy) {
    extras.push({ name: '에폭시', cost: getExtraCharge(rangeConfig.extraCharges.epoxy) * qty });
  }
  if (form.postProcessing.foil !== '없음') {
    const charge = rangeConfig.extraCharges.foil[form.postProcessing.foil];
    if (charge) {
      extras.push({ name: `박 (${form.postProcessing.foil})`, cost: getExtraCharge(charge) * qty });
    }
  }

  const extrasTotal = extras.reduce((sum, item) => sum + item.cost, 0);
  const endpaperFinal = endpaperTotal - endpaperDiscount;

  const total = innerFinal + coverFinal + extrasTotal + endpaperFinal;

  return {
    inner: { base: innerTotal, discount: innerDiscount, final: innerFinal },
    cover: { base: coverTotal, discount: coverDiscount, final: coverFinal },
    endpaper: { base: endpaperTotal, discount: endpaperDiscount, final: endpaperFinal },
    extras,
    extrasTotal,
    totalInnerPages: form.innerSections.reduce((sum, s) => sum + s.pages, 0),
    total: Math.round(total)
  };
};

const FilterBar = ({ 
  searchTerm, setSearchTerm, startDate, setStartDate, endDate, setEndDate, placeholder = "주문명, 거래처, 주문번호 검색..." 
}) => {
  return (
    <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
        <Calendar className="w-3.5 h-3.5 text-gray-400" />
        <input 
          type="date" 
          className="text-xs outline-none bg-transparent text-gray-600"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <span className="text-gray-300">~</span>
        <input 
          type="date" 
          className="text-xs outline-none bg-transparent text-gray-600"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        {(startDate || endDate) && (
          <button 
            onClick={() => { setStartDate(''); setEndDate(''); }}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            title="날짜 필터 초기화"
          >
            <X className="w-3 h-3 text-gray-400" />
          </button>
        )}
      </div>

      <div className="relative flex-1 md:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input 
          type="text"
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-3 h-3 text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [form, setForm] = useState(INITIAL_STATE);
  const [orders, setOrders] = useState([]);
  const [userView, setUserView] = useState('quote');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [priceConfig, setPriceConfig] = useState(DEFAULT_PRICE_CONFIG);
  const [selectedRangeId, setSelectedRangeId] = useState(DEFAULT_PRICE_CONFIG.ranges[0].id);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [adminTab, setAdminTab] = useState('prices');
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState(null);
  const [companyForm, setCompanyForm] = useState({ name: '', code: '', priceMode: 'general' });
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [showAddressList, setShowAddressList] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressLabel, setAddressLabel] = useState('');
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [orderStartDate, setOrderStartDate] = useState('');
  const [orderEndDate, setOrderEndDate] = useState('');
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // Load saved form and orders on mount
  useEffect(() => {
    const savedForm = localStorage.getItem('print_quote_form');
    if (savedForm) {
      try {
        const parsedForm = JSON.parse(savedForm);
        // Data migration: ensure form has required arrays
        const migratedForm = {
          ...INITIAL_STATE,
          ...parsedForm,
          innerSections: parsedForm.innerSections || INITIAL_STATE.innerSections,
          delivery: {
            ...INITIAL_STATE.delivery,
            ...parsedForm.delivery,
            locations: parsedForm.delivery?.locations || INITIAL_STATE.delivery.locations
          }
        };
        setForm(migratedForm);
      } catch (e) {
        console.error('Failed to load saved form', e);
      }
    }

    const savedOrders = localStorage.getItem('print_quote_orders');
    if (savedOrders) {
      try {
        const parsedOrders = JSON.parse(savedOrders);
        if (Array.isArray(parsedOrders) && parsedOrders.length > 0) {
          // Data migration: ensure all orders have required arrays and unique IDs
          const migratedOrders = parsedOrders.map((o, index) => ({
            ...o,
            id: o.id || `ORD-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
            innerSections: o.innerSections || [],
            delivery: {
              ...o.delivery,
              locations: o.delivery?.locations || []
            }
          }));

          // Ensure unique IDs across the entire list
          const uniqueOrders = [];
          const seenIds = new Set();
          migratedOrders.forEach((o) => {
            let uniqueId = o.id;
            let counter = 1;
            while (seenIds.has(uniqueId)) {
              uniqueId = `${o.id}-${counter}`;
              counter++;
            }
            seenIds.add(uniqueId);
            uniqueOrders.push({ ...o, id: uniqueId });
          });

          setOrders(uniqueOrders);
        } else {
          setOrders(INITIAL_SEED_ORDERS);
          localStorage.setItem('print_quote_orders', JSON.stringify(INITIAL_SEED_ORDERS));
        }
      } catch (e) {
        console.error('Failed to load saved orders', e);
        setOrders(INITIAL_SEED_ORDERS);
        localStorage.setItem('print_quote_orders', JSON.stringify(INITIAL_SEED_ORDERS));
      }
    } else {
      setOrders(INITIAL_SEED_ORDERS);
      localStorage.setItem('print_quote_orders', JSON.stringify(INITIAL_SEED_ORDERS));
    }

    const savedAddrs = localStorage.getItem('print_quote_addresses');
    if (savedAddrs) {
      try {
        setSavedAddresses(JSON.parse(savedAddrs));
      } catch (e) {
        console.error('Failed to load saved addresses', e);
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('print_quote_form', JSON.stringify(form));
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  const handleOrder = (price) => {
    if (!form.orderName) {
      alert('주문명을 입력해 주세요.');
      return;
    }
    
    let updatedOrders;
    
    if (editingOrderId) {
      updatedOrders = orders.map(o => o.id === editingOrderId ? {
        ...form,
        id: o.id,
        orderDate: o.orderDate,
        totalPrice: price,
        status: o.status
      } : o);
      alert('주문 내용이 수정되었습니다.');
    } else {
      const now = new Date();
      const dateStr = now.getFullYear().toString() + 
                      (now.getMonth() + 1).toString().padStart(2, '0') + 
                      now.getDate().toString().padStart(2, '0');
      
      // Find orders from today to determine the next number
      const todayOrders = orders.filter(o => o.id.startsWith(dateStr));
      const nextNum = todayOrders.length + 1;
      const orderId = `${dateStr}_${nextNum}`;

      const formattedDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const newOrder = {
        ...form,
        id: orderId,
        orderDate: formattedDate,
        totalPrice: price,
        status: '대기'
      };
      updatedOrders = [newOrder, ...orders];
      alert('주문이 완료되었습니다. 주문 목록으로 이동합니다.');
    }

    setOrders(updatedOrders);
    localStorage.setItem('print_quote_orders', JSON.stringify(updatedOrders));
    setEditingOrderId(null);
    setUserView('orders');
  };

  const deleteOrder = (id) => {
    if (!window.confirm('해당 주문 내역을 삭제하시겠습니까?')) return;
    const updatedOrders = orders.filter(o => o.id !== id);
    setOrders(updatedOrders);
    localStorage.setItem('print_quote_orders', JSON.stringify(updatedOrders));
  };

  const updateOrderStatus = (id, newStatus) => {
    const updated = orders.map(o => o.id === id ? { ...o, status: newStatus } : o);
    setOrders(updated);
    localStorage.setItem('print_quote_orders', JSON.stringify(updated));
  };

  const parseOrderDate = (dateStr) => {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    
    // Try parsing YYYY-MM-DD-HH:mm
    const parts = dateStr.split('-');
    if (parts.length === 4) {
      const [y, m, day, time] = parts;
      const [h, min] = time.split(':');
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(day), parseInt(h), parseInt(min));
    }
    return new Date(0);
  };

  const exportToExcel = (data, fileName) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const exportOrderListExcel = () => {
    const getStandardSizeDimensions = (size) => {
      if (size === '46판') return '128x188';
      if (size === '신국판') return '152x225';
      if (size === '46배판') return '188x257';
      if (size === '국배판') return '210x297';
      return size;
    };

    const data = filteredOrders.map(order => {
      const totalPages = order.innerSections.reduce((sum, s) => sum + s.pages, 0);
      const postProcessing = [
        order.postProcessing.foil !== '없음' ? `박(${order.postProcessing.foil})` : '',
        order.postProcessing.epoxy ? '에폭시' : ''
      ].filter(Boolean).join(', ') || '없음';

      return {
        '주문번호': order.id,
        '주문일시': order.orderDate,
        '업체명': order.companyInfo.publisherName || '-',
        '주문명(도서명)': order.orderName,
        '부수': order.quantity,
        '본문 페이지 수': totalPages,
        '규격_가로x규격_세로': order.customSize ? `${order.customSize.width}x${order.customSize.height}` : getStandardSizeDimensions(order.size),
        '표지_용지 표지_평량': `${order.cover.paper} ${order.cover.weight}g`,
        '표지_날개': order.cover.hasFlaps ? '있음' : '없음',
        '표지 코팅': order.cover.coating,
        '띠지': order.bellyBand?.enabled ? '있음' : '없음',
        '띠지 사양': order.bellyBand?.enabled ? `${order.bellyBand.paper} ${order.bellyBand.weight}g / ${order.bellyBand.printing} / ${order.bellyBand.coating}` : '-',
        '자켓': order.jacket?.enabled ? '있음' : '없음',
        '자켓 사양': order.jacket?.enabled ? `${order.jacket.paper} ${order.jacket.weight}g / ${order.jacket.printing} / ${order.jacket.coating}` : '-',
        '기타 후가공(에폭시, 박 등 기입)': postProcessing,
        '출고 희망일': order.delivery.desiredDate || '-',
        '실제 출고일': order.status === '출고 완료' ? '출고 완료' : '-'
      };
    });
    exportToExcel(data, `주문목록_${new Date().toISOString().split('T')[0]}`);
  };

  const exportSalesDetailExcel = () => {
    const data = filteredOrders.map(order => {
      const breakdown = calculatePriceBreakdown(order, priceConfig);
      
      // Separate cover-related extras
      const coverExtras = breakdown.extras.filter(e => e.name === '표지 양면인쇄' || e.name === '표지 날개');
      const coverExtrasCost = coverExtras.reduce((sum, e) => sum + e.cost, 0);
      
      // Other extras (post-processing)
      const postProcessingExtras = breakdown.extras.filter(e => e.name !== '표지 양면인쇄' && e.name !== '표지 날개');
      const postProcessingCost = postProcessingExtras.reduce((sum, e) => sum + e.cost, 0);

      return {
        '주문번호': order.id,
        '주문일': parseOrderDate(order.orderDate).toLocaleDateString(),
        '발주처': order.companyInfo.publisherName || '-',
        '도서명': order.orderName,
        '부수': order.quantity,
        '본문 인쇄비용': breakdown.inner.final,
        '표지 인쇄비용(날개 접지비용 포함)': breakdown.cover.final + coverExtrasCost,
        '후가공 비용': postProcessingCost,
        '면지 비용': breakdown.endpaper.final,
        '총 합계': breakdown.total,
        '상태': order.status
      };
    });
    
    exportToExcel(data, `매출상세내역_${new Date().toISOString().split('T')[0]}`);
  };

  const exportOrdersToExcelBackup = () => {
    const getStandardSizeDimensions = (size) => {
      if (size === '46판') return '128x188';
      if (size === '신국판') return '152x225';
      if (size === '46배판') return '188x257';
      if (size === '국배판') return '210x297';
      return size;
    };

    const data = orders.map(order => {
      const totalPages = order.innerSections.reduce((sum, s) => sum + s.pages, 0);
      const postProcessing = [
        order.postProcessing.foil !== '없음' ? `박(${order.postProcessing.foil})` : '',
        order.postProcessing.epoxy ? '에폭시' : ''
      ].filter(Boolean).join(', ') || '없음';

      return {
        '주문번호': order.id,
        '주문일시': order.orderDate,
        '업체명': order.companyInfo.publisherName || '-',
        '주문명(도서명)': order.orderName,
        '부수': order.quantity,
        '본문 페이지 수': totalPages,
        '규격_가로x규격_세로': order.customSize ? `${order.customSize.width}x${order.customSize.height}` : getStandardSizeDimensions(order.size),
        '표지_용지 표지_평량': `${order.cover.paper} ${order.cover.weight}g`,
        '표지_날개': order.cover.hasFlaps ? '있음' : '없음',
        '표지 코팅': order.cover.coating,
        '띠지': order.bellyBand?.enabled ? '있음' : '없음',
        '띠지 사양': order.bellyBand?.enabled ? `${order.bellyBand.paper} ${order.bellyBand.weight}g / ${order.bellyBand.printing} / ${order.bellyBand.coating}` : '-',
        '자켓': order.jacket?.enabled ? '있음' : '없음',
        '자켓 사양': order.jacket?.enabled ? `${order.jacket.paper} ${order.jacket.weight}g / ${order.jacket.printing} / ${order.jacket.coating}` : '-',
        '기타 후가공(에폭시, 박 등 기입)': postProcessing,
        '출고 희망일': order.delivery.desiredDate || '-',
        '실제 출고일': order.status === '출고 완료' ? '출고 완료' : '-',
        // Keep JSON data for perfect restoration
        '내지_상세_JSON': order.innerSections.map(s => `${s.paper} ${s.weight}`).join(', '),
        '배송지_JSON': JSON.stringify(order.delivery.locations),
        '업체_코드': order.companyInfo.code,
        '담당자_명': order.companyInfo.contactName,
        '담당자_연락처': order.companyInfo.contactPhone,
        '제본': order.binding,
        '면지_종류': order.postProcessing.endpaper,
        '면지_색상': order.postProcessing.endpaperColor || '',
        '면지_페이지': order.postProcessing.endpaperPages,
        '할인_적용': order.applyDiscount ? 'Y' : 'N',
        '총금액': order.totalPrice,
        '상태': order.status
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OrdersBackup");
    XLSX.writeFile(wb, `주문데이터_백업_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const importOrdersFromExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const findCol = (row, keywords) => {
          const keys = Object.keys(row);
          for (const k of keys) {
            const cleanK = k.replace(/[\s_]/g, '').toLowerCase();
            if (keywords.some(kw => cleanK.includes(kw.toLowerCase().replace(/[\s_]/g, '')))) {
              return row[k];
            }
          }
          return undefined;
        };

        const importedOrders = jsonData.map((row) => {
          const qty = Number(findCol(row, ['수량', '부수', 'Qty', 'Quantity'])) || 100;
          const name = String(findCol(row, ['주문명', '도서명', '제목', 'Name', 'Title', '주문명(도서명)']) || '');
          let sizeVal = findCol(row, ['규격', '사이즈', 'Size', '규격_가로x규격_세로']);
          let customSize = undefined;
          
          if (typeof sizeVal === 'string' && sizeVal.includes('x')) {
            const parts = sizeVal.split('x');
            if (parts.length === 2) {
              const w = Number(parts[0]);
              const h = Number(parts[1]);
              if (!isNaN(w) && !isNaN(h)) {
                customSize = { width: w, height: h };
                // Try to map back to standard size
                if (w === 128 && h === 188) sizeVal = '46판';
                else if (w === 152 && h === 225) sizeVal = '신국판';
                else if (w === 188 && h === 257) sizeVal = '46배판';
                else if (w === 210 && h === 297) sizeVal = '국배판';
                else sizeVal = '직접 입력';
              }
            }
          } else if (row['규격_가로'] && row['규격_세로']) {
            customSize = { width: Number(row['규격_가로']), height: Number(row['규격_세로']) };
            sizeVal = '직접 입력';
          }

          const size = (sizeVal || '신국판');
          
          // Try to parse inner sections
          let innerSections = [];
          const innerJson = findCol(row, ['내지_상세_JSON', 'InnerSections']);
          const totalPages = Number(findCol(row, ['내지페이지', '내지_페이지', 'Pages', '본문 페이지 수'])) || 200;

          if (innerJson) {
            try {
              // Try JSON first
              const parsed = JSON.parse(innerJson);
              innerSections = Array.isArray(parsed) ? parsed : [];
            } catch (e) {
              // Try comma separated format: "Paper Weight, Paper Weight"
              const sections = String(innerJson).split(',').map((s, idx) => {
                const parts = s.trim().split(' ');
                const weight = parts.pop() || '80g';
                const paper = parts.join(' ') || '백색 모조지';
                return {
                  id: String(idx + 1),
                  paper: paper,
                  weight: (weight.includes('g') ? weight : `${weight}g`),
                  printing: '1도',
                  pages: idx === 0 ? totalPages : 0 // Assign all pages to first section if unknown
                };
              });
              innerSections = sections;
            }
          }

          if (innerSections.length === 0) {
            // Fallback: try to find basic inner paper info
            const innerPaper = findCol(row, ['내지용지', '내지_용지', 'Inner Paper']) || '백색 모조지';
            const innerWeight = String(findCol(row, ['내지평량', '내지_평량', 'Inner Weight']) || '80');
            innerSections = [{
              id: '1',
              paper: innerPaper,
              weight: (innerWeight.includes('g') ? innerWeight : `${innerWeight}g`),
              printing: (findCol(row, ['내지인쇄', '내지_인쇄', 'Inner Printing']) || '1도'),
              pages: totalPages
            }];
          }

          const locationsJson = findCol(row, ['배송지_JSON', 'Locations']);
          let locations = [];
          if (locationsJson) {
            try {
              const parsed = JSON.parse(locationsJson);
              locations = Array.isArray(parsed) ? parsed : [];
            } catch (e) {
              locations = [];
            }
          }
          if (locations.length === 0) {
            locations = [{
              id: '1',
              quantity: qty,
              address: String(findCol(row, ['배송지', '주소', 'Address']) || ''),
              contactName: String(findCol(row, ['담당자', '성함', 'Contact']) || ''),
              contactPhone: String(findCol(row, ['연락처', '전화번호', 'Phone']) || ''),
              method: '택배'
            }];
          }

          return {
            id: String(findCol(row, ['ID', 'No', '주문번호']) || Math.random().toString(36).substr(2, 9)),
            orderDate: String(findCol(row, ['주문일시', 'OrderDate', 'Date']) || new Date().toISOString()),
            orderName: name,
            size: size,
            customSize: customSize,
            quantity: qty,
            cover: (() => {
              const combined = findCol(row, ['표지_용지 표지_평량', '표지용지표지평량']);
              let paper = (findCol(row, ['표지용지', '표지_용지', 'Cover Paper']) || '스노우');
              let weight = String(findCol(row, ['표지평량', '표지_평량', 'Cover Weight']) || '250');
              
              if (combined && typeof combined === 'string') {
                const parts = combined.split(' ');
                const w = parts.pop()?.replace('g', '') || '250';
                const p = parts.join(' ') || '스노우';
                paper = p;
                weight = w;
              }

              return {
                paper: paper,
                customPaper: String(findCol(row, ['표지_직접입력', 'Cover Custom']) || ''),
                weight: weight,
                printing: (findCol(row, ['표지인쇄', '표지_인쇄', 'Cover Printing']) || '단면 4도'),
                hasFlaps: findCol(row, ['표지날개', '표지_날개', 'Flaps']) === 'Y' || findCol(row, ['표지날개', '표지_날개', 'Flaps']) === '있음',
                coating: (findCol(row, ['표지코팅', '표지_코팅', 'Coating']) || '무광'),
              };
            })(),
            bellyBand: {
              enabled: findCol(row, ['띠지', 'BellyBand']) === 'Y' || findCol(row, ['띠지']) === '있음',
              paper: (findCol(row, ['띠지용지', '띠지_용지', 'BellyBand Paper']) || '스노우'),
              weight: String(findCol(row, ['띠지평량', '띠지_평량', 'BellyBand Weight']) || '150'),
              printing: (findCol(row, ['띠지인쇄', '띠지_인쇄', 'BellyBand Printing']) || '단면 4도'),
              coating: (findCol(row, ['띠지코팅', '띠지_코팅', 'BellyBand Coating']) || '무광'),
            },
            jacket: {
              enabled: findCol(row, ['자켓', 'Jacket']) === 'Y' || findCol(row, ['자켓']) === '있음',
              paper: (findCol(row, ['자켓용지', '자켓_용지', 'Jacket Paper']) || '스노우'),
              weight: String(findCol(row, ['자켓평량', '자켓_평량', 'Jacket Weight']) || '150'),
              printing: (findCol(row, ['자켓인쇄', '자켓_인쇄', 'Jacket Printing']) || '단면 4도'),
              coating: (findCol(row, ['자켓코팅', '자켓_코팅', 'Jacket Coating']) || '무광'),
            },
            innerSections,
            binding: (findCol(row, ['제본', 'Binding']) || '세로 좌철'),
            postProcessing: {
              endpaper: (findCol(row, ['면지종류', '면지_종류', 'Endpaper']) || '없음'),
              endpaperColor: String(findCol(row, ['면지색상', '면지_색상', 'Endpaper Color']) || ''),
              endpaperPages: Number(findCol(row, ['면지페이지', '면지_페이지', 'Endpaper Pages'])) || 4,
              epoxy: findCol(row, ['에폭시', 'Epoxy']) === 'Y' || findCol(row, ['에폭시']) === '있음' || (findCol(row, ['기타 후가공', '기타_후가공'])?.includes('에폭시')),
              foil: (findCol(row, ['박종류', '박_종류', 'Foil']) || '없음'),
            },
            companyInfo: {
              code: String(findCol(row, ['업체코드', '업체_코드', 'Company Code']) || ''),
              publisherName: String(findCol(row, ['업체명', '업체_명', '발주처', 'Publisher']) || ''),
              contactName: String(findCol(row, ['담당자명', '담당자_명', '담당자', '성함', 'Contact Name']) || ''),
              contactPhone: String(findCol(row, ['담당자연락처', '담당자_연락처', '연락처', '전화번호', 'Phone']) || ''),
            },
            delivery: {
              desiredDate: String(findCol(row, ['출고희망일', '출고_희망일', 'Desired Date']) || ''),
              locations,
              requests: String(findCol(row, ['요청사항', 'Requests', 'Memo']) || ''),
            },
            applyDiscount: findCol(row, ['할인적용', '할인_적용']) === 'Y',
            totalPrice: Number(findCol(row, ['총금액', '금액', 'Price', '총 합계'])) || 0,
            status: (findCol(row, ['상태', 'Status']) || '대기'),
          };
        });

        if (importedOrders.length > 0) {
          const newOrders = [...importedOrders, ...orders];
          setOrders(newOrders);
          localStorage.setItem('print_quote_orders', JSON.stringify(newOrders));
          alert(`${importedOrders.length}건의 주문을 성공적으로 불러왔습니다.`);
        }
      } catch (err) {
        console.error(err);
        alert('Excel 파일 형식이 올바르지 않거나 데이터가 손상되었습니다.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const importOrdersFromText = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 1) return;
    
    // Simple CSV/TSV parser that handles quotes
    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      // Detect separator (tab or comma)
      const separator = line.includes('\t') ? '\t' : ',';
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const firstLineCols = parseCSVLine(lines[0]);
    const hasHeaders = firstLineCols.some(h => 
      ['주문일', '발주처', '거래처', '도서명', '제목', '부수', '수량', '페이지', '쪽수'].some(keyword => h.includes(keyword))
    );
    
    const headers = hasHeaders ? firstLineCols : [];
    const rows = hasHeaders ? lines.slice(1) : lines;

    const findCol = (row, possibleNames, defaultIdx) => {
      if (hasHeaders) {
        const idx = headers.findIndex(h => possibleNames.some(name => h.includes(name)));
        if (idx !== -1) return row[idx] || '';
      }
      return row[defaultIdx] || '';
    };

    const importedOrders = rows.map((line, idx) => {
      const cols = parseCSVLine(line);
      if (cols.length < 5) return null;

      const orderDateRaw = findCol(cols, ['주문일', '날짜', 'Date'], 0);
      const now = new Date();
      const year = now.getFullYear();
      const monthMatch = orderDateRaw.match(/(\d+)월/);
      const dayMatch = orderDateRaw.match(/(\d+)일/);
      const month = monthMatch ? parseInt(monthMatch[1]) : now.getMonth() + 1;
      const day = dayMatch ? parseInt(dayMatch[1]) : now.getDate();
      const orderDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}-09:00`;

      const quantityRaw = findCol(cols, ['부수', '수량', 'Qty', 'Quantity'], 5);
      const quantity = parseInt(quantityRaw.replace(/[^0-9]/g, '')) || 100;
      
      const pagesRaw = findCol(cols, ['페이지', '쪽수', 'Pages', 'Page'], 6);
      const totalPages = parseInt(pagesRaw.replace(/[^0-9]/g, '')) || 200;
      
      const sizeRaw = findCol(cols, ['규격', '사이즈', 'Size'], 7);
      let size = '신국판';
      let customSize = undefined;
      
      if (sizeRaw.includes('x')) {
        const dimensions = sizeRaw.match(/(\d+)x(\d+)/);
        if (dimensions) {
          const w = parseInt(dimensions[1]);
          const h = parseInt(dimensions[2]);
          customSize = { width: w, height: h };
          if (sizeRaw.includes('46판')) size = '46판';
          else if (sizeRaw.includes('신국판')) size = '신국판';
          else if (sizeRaw.includes('46배판')) size = '46배판';
          else if (sizeRaw.includes('국배판')) size = '국배판';
          else if (w === 128 && h === 188) size = '46판';
          else if (w === 152 && h === 225) size = '신국판';
          else if (w === 188 && h === 257) size = '46배판';
          else if (w === 210 && h === 297) size = '국배판';
          else size = '직접 입력';
        }
      }

      const coverPaperRaw = findCol(cols, ['표지용지', '표지 용지', 'Cover Paper'], 11);
      const coverParts = coverPaperRaw.split(' ');
      const coverWeight = coverParts.pop()?.replace(/[^0-9]/g, '') || '250';
      const coverPaper = coverParts.join(' ') || '스노우';

      const innerPaperRaw = findCol(cols, ['내지용지', '내지 용지', 'Inner Paper'], 17);
      const innerParts = innerPaperRaw.split(' ');
      const innerWeight = innerParts.pop()?.replace(/[^0-9]/g, '') || '80';
      const innerPaper = innerParts.join(' ') || '백색 모조지';

      const orderName = findCol(cols, ['도서명', '제목', 'Title', 'Name'], 4);
      const publisherName = findCol(cols, ['발주처', '거래처', 'Publisher', 'Company'], 3);
      const totalPriceRaw = findCol(cols, ['금액', '합계', 'Price', 'Total'], 9);
      const totalPrice = parseInt(totalPriceRaw.replace(/[^0-9]/g, '')) || 0;
      const desiredDate = findCol(cols, ['출고희망일', '희망일', '납기'], 1);
      const requests = findCol(cols, ['요청사항', '비고', 'Requests', 'Note'], 20);
      
      const coverPrintingRaw = findCol(cols, ['표지인쇄', '표지 인쇄', 'Cover Print'], 12);
      const coverFlapsRaw = findCol(cols, ['표지날개', '날개', 'Flaps'], 14);
      const coverCoatingRaw = findCol(cols, ['표지코팅', '코팅', 'Coating'], 15);
      const bindingRaw = findCol(cols, ['제본', 'Binding'], 13);
      const innerPrintingRaw = findCol(cols, ['내지인쇄', '내지 인쇄', 'Inner Print'], 18);
      const postProcessingRaw = findCol(cols, ['후가공', 'Extras'], 16);
      const endpaperRaw = findCol(cols, ['면지', 'Endpaper'], 19);

      return {
        id: `PB-${Date.now().toString().slice(-6)}-${idx}`,
        orderDate,
        orderName,
        size,
        customSize,
        quantity,
        cover: {
          paper: coverPaper,
          weight: coverWeight,
          printing: (coverPrintingRaw.includes('양면') ? '양면 4도' : '단면 4도'),
          hasFlaps: coverFlapsRaw.includes('날개') || coverFlapsRaw.includes('O') || coverFlapsRaw.includes('있음'),
          coating: (coverCoatingRaw.includes('유광') ? '유광' : coverCoatingRaw.includes('무광') ? '무광' : '엠보'),
        },
        innerSections: [{
          id: '1',
          paper: (innerPaper.includes('미색') ? '미색 모조지' : innerPaper.includes('에스플러스') ? '백색 에스플러스' : '백색 모조지'),
          weight: (innerWeight.includes('g') ? innerWeight : `${innerWeight}g`),
          printing: (innerPrintingRaw.includes('4도') ? '4도' : innerPrintingRaw.includes('2도') ? '2도' : '1도'),
          pages: totalPages
        }],
        binding: (bindingRaw.includes('가로') ? '가로 좌철' : '세로 좌철'),
        postProcessing: {
          endpaper: endpaperRaw.includes('인쇄') ? '베다인쇄' : endpaperRaw.includes('색지') ? '제물면지' : '없음',
          endpaperPages: 4,
          epoxy: postProcessingRaw.includes('에폭시'),
          foil: postProcessingRaw.includes('박') ? '유광 금박' : '없음',
        },
        companyInfo: {
          code: '',
          publisherName,
          contactName: '',
          contactPhone: '',
        },
        delivery: {
          desiredDate,
          locations: [{
            id: '1',
            quantity,
            address: '',
            contactName: '',
            contactPhone: '',
            method: (desiredDate.includes('퀵') ? '퀵' : desiredDate.includes('방문') ? '방문수령' : '택배')
          }],
          requests,
        },
        applyDiscount: false,
        totalPrice,
        status: '대기'
      };
    }).filter(Boolean);

    if (importedOrders.length > 0) {
      const newOrders = [...importedOrders, ...orders];
      setOrders(newOrders);
      localStorage.setItem('print_quote_orders', JSON.stringify(newOrders));
      alert(`${importedOrders.length}건의 주문을 성공적으로 불러왔습니다.`);
      setIsPasteModalOpen(false);
      setPasteText('');
    }
  };

  const exportWorkOrderExcel = (order) => {
    const totalPages = order.innerSections.reduce((sum, s) => sum + s.pages, 0);
    const data = [
      { '항목': '주문번호', '내용': order.id },
      { '항목': '주문일', '내용': parseOrderDate(order.orderDate).toLocaleDateString() },
      { '항목': '발주처', '내용': order.companyInfo.publisherName },
      { '항목': '담당자', '내용': `${order.companyInfo.contactName} (${order.companyInfo.contactPhone})` },
      { '항목': '도서명', '내용': order.orderName },
      { '항목': '부수', '내용': `${order.quantity}부` },
      { '항목': '규격', '내용': `${order.size} (${order.customSize?.width}x${order.customSize?.height}mm)` },
      { '항목': '제본', '내용': order.binding },
      { '항목': '페이지', '내용': `${totalPages}p` },
      { '항목': '표지 용지', '내용': `${order.cover.paper} ${order.cover.weight}g` },
      { '항목': '표지 인쇄', '내용': order.cover.printing },
      { '항목': '표지 코팅', '내용': order.cover.coating },
      { '항목': '표지 날개', '내용': order.cover.hasFlaps ? '있음' : '없음' },
      ...order.innerSections.map((s, i) => ({ '항목': `내지 ${i+1} 용지/인쇄`, '내용': `${s.paper} ${s.weight} / ${s.printing} (${s.pages}p)` })),
      { '항목': '면지', '내용': order.postProcessing.endpaper !== '없음' 
        ? `${order.postProcessing.endpaper}${order.postProcessing.endpaperColor ? ` (${order.postProcessing.endpaperColor})` : ''} (${order.postProcessing.endpaperPages}p)` 
        : '없음' },
      ...(order.bellyBand?.enabled ? [{ '항목': '띠지', '내용': `${order.bellyBand.paper} ${order.bellyBand.weight}g / ${order.bellyBand.printing} / ${order.bellyBand.coating}` }] : []),
      ...(order.jacket?.enabled ? [{ '항목': '자켓', '내용': `${order.jacket.paper} ${order.jacket.weight}g / ${order.jacket.printing} / ${order.jacket.coating}` }] : []),
      { '항목': '후가공', '내용': `박: ${order.postProcessing.foil}, 에폭시: ${order.postProcessing.epoxy ? '있음' : '없음'}` },
      { '항목': '배송정보', '내용': order.delivery.locations.map(l => `[${l.method}] ${l.quantity}부: ${l.address} (${l.contactName} ${l.contactPhone})`).join('\n') },
      { '항목': '출고희망일', '내용': order.delivery.desiredDate },
      { '항목': '요청사항', '내용': order.delivery.requests }
    ];
    exportToExcel(data, `작업지시서_${order.orderName}_${order.id}`);
  };

  const exportQuoteExcel = (order) => {
    const breakdown = calculatePriceBreakdown(order, priceConfig);
    const data = [
      { '항목': '도서명', '내용': order.orderName, '금액': '' },
      { '항목': '부수', '내용': `${order.quantity}부`, '금액': '' },
      { '항목': '표지 인쇄비', '내용': order.cover.printing, '금액': breakdown.cover.final },
      { '항목': '내지 인쇄비', '내용': `${order.innerSections.length}개 섹션`, '금액': breakdown.inner.final },
      { '항목': '면지 비용', '내용': order.postProcessing.endpaper, '금액': breakdown.endpaper.final },
      ...breakdown.extras.map(e => ({ '항목': e.name, '내용': '옵션', '금액': e.cost })),
      { '항목': '합계 (부가세 별도)', '내용': '', '금액': breakdown.total }
    ];
    exportToExcel(data, `견적서_${order.orderName}_${order.id}`);
  };

  const editOrder = (order) => {
    const { id, orderDate, totalPrice, status, ...formContent } = order;
    
    // Ensure default values for new fields when loading old orders
    const updatedForm = {
      ...formContent,
      customSize: order.customSize || { width: 128, height: 188 },
      cover: {
        ...order.cover,
        customPaper: order.cover.customPaper || ''
      },
      bellyBand: order.bellyBand || INITIAL_STATE.bellyBand,
      jacket: order.jacket || INITIAL_STATE.jacket,
      postProcessing: {
        ...order.postProcessing,
        endpaperColor: order.postProcessing.endpaperColor || '',
        endpaperPages: order.postProcessing.endpaperPages || 4
      },
      applyDiscount: formContent.applyDiscount || false
    };
    
    setForm(updatedForm);
    setEditingOrderId(id);
    setUserView('quote');
    window.scrollTo(0, 0);
  };

  const loadOrder = (order) => {
    const { id, orderDate, totalPrice, status, ...formContent } = order;
    
    const updatedForm = {
      ...formContent,
      customSize: order.customSize || { width: 128, height: 188 },
      cover: {
        ...order.cover,
        customPaper: order.cover.customPaper || ''
      },
      bellyBand: order.bellyBand || INITIAL_STATE.bellyBand,
      jacket: order.jacket || INITIAL_STATE.jacket,
      postProcessing: {
        ...order.postProcessing,
        endpaperColor: order.postProcessing.endpaperColor || '',
        endpaperPages: order.postProcessing.endpaperPages || 4
      },
      applyDiscount: formContent.applyDiscount || false
    };
    
    setForm(updatedForm);
    setEditingOrderId(null);
    setUserView('quote');
    window.scrollTo(0, 0);
  };

  const reorder = (order) => {
    const { id, orderDate, totalPrice, status, ...formContent } = order;
    
    const updatedForm = {
      ...formContent,
      customSize: order.customSize || { width: 128, height: 188 },
      cover: {
        ...order.cover,
        customPaper: order.cover.customPaper || ''
      },
      bellyBand: order.bellyBand || INITIAL_STATE.bellyBand,
      jacket: order.jacket || INITIAL_STATE.jacket,
      postProcessing: {
        ...order.postProcessing,
        endpaperColor: order.postProcessing.endpaperColor || '',
        endpaperPages: order.postProcessing.endpaperPages || 4
      },
      applyDiscount: formContent.applyDiscount || false
    };
    
    setForm(updatedForm);
    setEditingOrderId(null);
    setUserView('quote');
    window.scrollTo(0, 0);
  };

  const saveAddress = (locationIndex) => {
    const loc = form.delivery.locations[locationIndex];
    if (!loc.address) {
      alert('배송 주소를 입력해 주세요.');
      return;
    }
    const label = prompt('배송지 별칭을 입력해 주세요 (예: 사무실, 창고)', editingAddressId ? savedAddresses.find(a => a.id === editingAddressId)?.label : '');
    if (!label) return;

    if (editingAddressId) {
      const updated = savedAddresses.map(a => a.id === editingAddressId ? { 
        ...a, 
        label, 
        address: loc.address, 
        contactName: loc.contactName, 
        contactPhone: loc.contactPhone 
      } : a);
      setSavedAddresses(updated);
      localStorage.setItem('print_quote_addresses', JSON.stringify(updated));
      setEditingAddressId(null);
      alert('배송지가 수정되었습니다.');
    } else {
      const newAddr = {
        id: Math.random().toString(36).substr(2, 9),
        label,
        address: loc.address,
        contactName: loc.contactName,
        contactPhone: loc.contactPhone
      };

      const updated = [...savedAddresses, newAddr];
      setSavedAddresses(updated);
      localStorage.setItem('print_quote_addresses', JSON.stringify(updated));
      alert('배송지가 저장되었습니다.');
    }
  };

  const startEditAddress = (addr, locationIndex) => {
    const newLocations = [...form.delivery.locations];
    newLocations[locationIndex] = {
      ...newLocations[locationIndex],
      address: addr.address,
      contactName: addr.contactName,
      contactPhone: addr.contactPhone
    };
    setForm(prev => ({
      ...prev,
      delivery: { ...prev.delivery, locations: newLocations }
    }));
    setEditingAddressId(addr.id);
    setShowAddressList(false);
    alert('현재 입력된 정보로 배송지를 수정할 수 있습니다. 수정한 후 "배송지 저장" 버튼을 눌러주세요.');
  };

  const deleteAddress = (id) => {
    const updated = savedAddresses.filter(a => a.id !== id);
    setSavedAddresses(updated);
    localStorage.setItem('print_quote_addresses', JSON.stringify(updated));
  };

  const selectAddress = (addr, locationIndex) => {
    const newLocations = [...form.delivery.locations];
    newLocations[locationIndex] = {
      ...newLocations[locationIndex],
      address: addr.address,
      contactName: addr.contactName,
      contactPhone: addr.contactPhone
    };
    setForm(prev => ({
      ...prev,
      delivery: { ...prev.delivery, locations: newLocations }
    }));
    setShowAddressList(false);
  };

  const [activeLocationIndex, setActiveLocationIndex] = useState(0);

  const addDeliveryLocation = () => {
    const remainingQty = form.quantity - form.delivery.locations.reduce((sum, l) => sum + l.quantity, 0);
    setForm({
      ...form,
      delivery: {
        ...form.delivery,
        locations: [
          ...form.delivery.locations,
          { id: Math.random().toString(36).substr(2, 9), quantity: Math.max(0, remainingQty), address: '', contactName: '', contactPhone: '', method: '택배' }
        ]
      }
    });
  };

  const removeDeliveryLocation = (id) => {
    if (form.delivery.locations.length <= 1) return;
    setForm({
      ...form,
      delivery: {
        ...form.delivery,
        locations: form.delivery.locations.filter(l => l.id !== id)
      }
    });
  };

  const updateDeliveryLocation = (index, updates) => {
    const newLocations = [...form.delivery.locations];
    newLocations[index] = { ...newLocations[index], ...updates };
    setForm({
      ...form,
      delivery: {
        ...form.delivery,
        locations: newLocations
      }
    });
  };

  // Auto-fill company name when code matches
  useEffect(() => {
    const inputCode = (form.companyInfo.code || '').trim().toLowerCase();
    if (!inputCode) return;
    
    const company = priceConfig.separateCompanies.find(c => 
      (c.code || '').trim().toLowerCase() === inputCode
    );
    
    if (company && form.companyInfo.publisherName !== company.name) {
      setForm(prev => ({
        ...prev,
        companyInfo: {
          ...prev.companyInfo,
          publisherName: company.name
        }
      }));
    }
  }, [form.companyInfo.code, priceConfig.separateCompanies]);

  const copyFromGeneral = (companyId) => {
    if (!confirm('현재 선택된 구간의 일반 단가를 이 거래처의 별도 단가로 복사하시겠습니까?')) return;
    
    setPriceConfig(prev => {
      const currentRange = prev.pricesByRange[selectedRangeId];
      
      // Deep clone innerPrices
      const newInnerPrices = JSON.parse(JSON.stringify(currentRange.innerPrices));
      
      // Copy inner prices
      Object.keys(newInnerPrices).forEach(size => {
        const s = size;
        Object.keys(newInnerPrices[s]).forEach(pt => {
          const p = pt;
          newInnerPrices[s][p].separate[companyId] = newInnerPrices[s][p].general;
        });
      });

      return {
        ...prev,
        pricesByRange: {
          ...prev.pricesByRange,
          [selectedRangeId]: {
            ...currentRange,
            innerPrices: newInnerPrices,
            standardCoverPrice: {
              ...currentRange.standardCoverPrice,
              separate: {
                ...currentRange.standardCoverPrice.separate,
                [companyId]: currentRange.standardCoverPrice.general
              }
            },
            extraCharges: {
              doubleSidedPrinting: {
                ...currentRange.extraCharges.doubleSidedPrinting,
                separate: { ...currentRange.extraCharges.doubleSidedPrinting.separate, [companyId]: currentRange.extraCharges.doubleSidedPrinting.general }
              },
              flaps: {
                ...currentRange.extraCharges.flaps,
                separate: { ...currentRange.extraCharges.flaps.separate, [companyId]: currentRange.extraCharges.flaps.general }
              },
              endpaper: Object.keys(currentRange.extraCharges.endpaper).reduce((acc, key) => {
                acc[key] = {
                  ...currentRange.extraCharges.endpaper[key],
                  separate: { ...currentRange.extraCharges.endpaper[key].separate, [companyId]: currentRange.extraCharges.endpaper[key].general }
                };
                return acc;
              }, {}),
              epoxy: {
                ...currentRange.extraCharges.epoxy,
                separate: { ...currentRange.extraCharges.epoxy.separate, [companyId]: currentRange.extraCharges.epoxy.general }
              },
              foil: Object.keys(currentRange.extraCharges.foil).reduce((acc, key) => {
                acc[key] = {
                  ...currentRange.extraCharges.foil[key],
                  separate: { ...currentRange.extraCharges.foil[key].separate, [companyId]: currentRange.extraCharges.foil[key].general }
                };
                return acc;
              }, {}),
            }
          }
        }
      };
    });
  };

  const priceBreakdown = useMemo(() => {
    return calculatePriceBreakdown(form, priceConfig);
  }, [form, priceConfig]);

  const totalPrice = priceBreakdown.total;

  const addInnerSection = () => {
    const newSection = {
      id: Math.random().toString(36).substr(2, 9),
      paper: '백색 모조지',
      weight: '80g',
      printing: '1도',
      pages: 100
    };
    setForm(prev => ({
      ...prev,
      innerSections: [...prev.innerSections, newSection]
    }));
  };

  const removeInnerSection = (id) => {
    if (form.innerSections.length <= 1) return;
    setForm(prev => ({
      ...prev,
      innerSections: prev.innerSections.filter(s => s.id !== id)
    }));
  };

  const updateInnerSection = (id, updates) => {
    setForm(prev => ({
      ...prev,
      innerSections: prev.innerSections.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  };

  const filteredOrders = useMemo(() => {
    let result = orders;
    
    // Search term filter
    if (orderSearchTerm.trim()) {
      const term = orderSearchTerm.toLowerCase();
      result = result.filter(o => 
        o.orderName.toLowerCase().includes(term) || 
        o.id.toLowerCase().includes(term) ||
        (o.companyInfo.publisherName || '').toLowerCase().includes(term)
      );
    }
    
    // Date range filter
    if (orderStartDate) {
      const start = new Date(orderStartDate);
      start.setHours(0, 0, 0, 0);
      result = result.filter(o => parseOrderDate(o.orderDate) >= start);
    }
    
    if (orderEndDate) {
      const end = new Date(orderEndDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter(o => parseOrderDate(o.orderDate) <= end);
    }
    
    return result;
  }, [orders, orderSearchTerm, orderStartDate, orderEndDate]);

  const productionSchedules = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const formatDate = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const todayStr = formatDate(today);
    
    // Calculate Tomorrow (or Next Monday if today is Friday)
    const tomorrow = new Date(today);
    const dayOfWeek = today.getDay(); // 0: Sun, 1: Mon, ..., 5: Fri, 6: Sat
    
    let tomorrowDaysToAdd = 1;
    let tomorrowLabel = '내일';
    
    if (dayOfWeek === 5) { // Friday
      tomorrowDaysToAdd = 3;
      tomorrowLabel = '다음주 월요일';
    } else if (dayOfWeek === 6) { // Saturday
      tomorrowDaysToAdd = 2;
      tomorrowLabel = '다음주 월요일';
    }
    
    tomorrow.setDate(today.getDate() + tomorrowDaysToAdd);
    const tomorrowStr = formatDate(tomorrow);

    // 3rd and 4th day
    const day3 = new Date(today);
    day3.setDate(today.getDate() + 3);
    const day3Str = formatDate(day3);

    const day4 = new Date(today);
    day4.setDate(today.getDate() + 4);
    const day4Str = formatDate(day4);

    return {
      today: orders.filter(o => o.delivery.desiredDate === todayStr && o.status !== '출고 완료'),
      tomorrow: orders.filter(o => o.delivery.desiredDate === tomorrowStr && o.status !== '출고 완료'),
      later: orders.filter(o => (o.delivery.desiredDate === day3Str || o.delivery.desiredDate === day4Str) && o.status !== '출고 완료'),
      tomorrowLabel,
      day3Str,
      day4Str
    };
  }, [orders]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 px-6 py-6 max-w-[1400px] mx-auto w-full">
        <div className="glass-card rounded-[2.5rem] px-8 h-20 flex items-center justify-between border-brand-50/50 shadow-2xl shadow-brand-100/10 active:scale-[0.99] transition-transform">
          <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setUserView('quote')}>
            <div className="bg-brand-600 p-3 rounded-2xl shadow-xl shadow-brand-200 group-hover:rotate-12 transition-transform duration-500">
              <BookOpen className="text-white w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tighter text-gray-900 leading-tight">PRINTOP</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-brand-600 uppercase tracking-[0.2em]">Enterprise</span>
                <div className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
              </div>
            </div>
          </div>
          
          <nav className="hidden xl:flex items-center gap-1 p-1.5 bg-gray-50/80 rounded-[1.5rem] border border-gray-100/50 scale-95 transition-transform origin-center">
            {[
              { id: 'quote', label: '견적 작성', icon: Edit2 },
              { id: 'orders', label: '주문 내역', icon: History },
              { id: 'production', label: '제작 관리', icon: Truck },
              { id: 'delivery', label: '출고 관리', icon: Package },
              { id: 'sales', label: '매출 관리', icon: TrendingUp },
              { id: 'customers', label: '거래처 관리', icon: User }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = !isAdminMode && userView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setIsAdminMode(false); setUserView(tab.id); }}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-[1.25rem] text-sm font-black transition-all duration-500 relative group ${
                    isActive
                    ? "bg-white text-brand-600 shadow-xl shadow-brand-100/20 translate-y-[-1px]"
                    : "text-gray-400 hover:text-gray-900 hover:bg-white/40"
                  }`}
                >
                  <Icon className={`${isActive ? 'text-brand-600' : 'text-gray-300 group-hover:text-gray-900'} w-4 h-4 transition-colors`} />
                  {tab.label}
                  {isActive && (
                    <motion.div 
                      layoutId="nav-pill"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand-600 rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-4">
            <div className="h-8 w-px bg-gray-100 mx-2 hidden lg:block" />
            <button 
              onClick={() => setIsAdminMode(!isAdminMode)}
              className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl text-xs font-black transition-all duration-500 border-2 uppercase tracking-widest ${
                isAdminMode 
                ? 'bg-gray-950 text-white border-gray-950 shadow-2xl shadow-gray-200' 
                : 'bg-white text-gray-500 border-gray-100 hover:border-brand-200 hover:text-brand-600 active:scale-95'
              }`}
            >
              <Settings className={`w-4 h-4 ${isAdminMode ? 'animate-spin-slow' : ''}`} />
              {isAdminMode ? '관리자 모드' : 'Admin'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pb-20">
        {isAdminMode ? (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-gray-100 pb-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-brand-600 font-bold mb-1">
                  <div className="w-8 h-8 bg-brand-100 rounded-xl flex items-center justify-center">
                    <Settings className="w-5 h-5" />
                  </div>
                  <span className="text-sm uppercase tracking-[0.2em]">Management</span>
                </div>
                <h2 className="text-4xl font-black text-gray-900 tracking-tight">시스템 관리자 센터</h2>
                <p className="text-gray-400 text-sm font-medium">서비스 운영에 필요한 핵심 데이터와 정책을 관리합니다.</p>
              </div>

              <div className="flex items-center gap-2 p-1.5 bg-gray-50/50 rounded-[1.5rem] border border-gray-100 shadow-inner">
                {[
                  { id: 'prices', label: '단가 정책 관리', icon: TrendingUp },
                  { id: 'companies', label: '거래처 데이터베이스', icon: User }
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button 
                      key={tab.id}
                      onClick={() => setAdminTab(tab.id)}
                      className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-black transition-all duration-300 ${
                        adminTab === tab.id 
                        ? 'text-brand-600 bg-white shadow-xl shadow-brand-100/10' 
                        : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {adminTab === 'prices' ? (
              <React.Fragment>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Range & Company Selector */}
              <section className="glass-card rounded-[2.5rem] p-8 lg:col-span-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 bg-brand-50/20 border-brand-100/30">
                <div className="flex items-center gap-2 overflow-x-auto pb-4 md:pb-0 w-full md:w-auto scrollbar-hide">
                  {priceConfig.ranges.map(range => (
                    <button
                      key={range.id}
                      onClick={() => setSelectedRangeId(range.id)}
                      className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-500 scale-95 origin-left ${
                        selectedRangeId === range.id
                        ? 'bg-brand-600 text-white shadow-xl shadow-brand-200'
                        : 'bg-white text-gray-400 hover:text-gray-900 border border-gray-100 hover:border-brand-200'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="flex-1 md:w-72 relative">
                    <select 
                      className="w-full px-6 py-3.5 rounded-2xl border-2 border-white/50 text-[11px] font-black uppercase tracking-widest outline-none focus:border-brand-500 bg-white/80 appearance-none pr-12 transition-all shadow-sm"
                      value={selectedCompanyId || ''}
                      onChange={e => setSelectedCompanyId(e.target.value || null)}
                    >
                      <option value="">Standard Policy (All)</option>
                      {priceConfig.separateCompanies.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                  {selectedCompanyId && (
                    <div className="flex items-center gap-3 animate-in fade-in zoom-in-95 duration-500">
                      <button 
                        onClick={() => setSelectedCompanyId(null)}
                        className="w-12 h-12 flex items-center justify-center bg-white border border-gray-100 text-gray-400 rounded-2xl hover:text-red-500 hover:border-red-100 transition-all shadow-sm active:scale-90"
                        title="Deselect"
                      >
                        <X className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => copyFromGeneral(selectedCompanyId)}
                        className="px-6 py-3.5 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 transition-all text-[10px] font-black flex items-center gap-2 shadow-xl shadow-brand-100 uppercase tracking-widest active:scale-95"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        일반 단가 복사
                      </button>
                    </div>
                  )}
                </div>
              </section>
              {/* Inner Prices per Page */}
              <section className="glass-card rounded-[2.5rem] overflow-hidden border-brand-50/50">
                <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white text-gray-900">
                  <div>
                    <h3 className="text-xl font-black tracking-tight">본문 페이지 단가</h3>
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mt-1">Cost per Unit Page</p>
                  </div>
                  <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600">
                    <BookOpen className="w-5 h-5" />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Dimension / Color</th>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">General</th>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Special</th>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-brand-600 text-right">Custom</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {SIZES.map(size => (
                        <React.Fragment key={size}>
                          <tr className="bg-brand-50/20">
                            <td colSpan={4} className="px-8 py-2.5 text-[9px] font-black text-brand-600 uppercase tracking-[0.2em]">{size}</td>
                          </tr>
                          {PRINTING_TYPES.map(pt => (
                            <tr key={`${size}-${pt}`} className="hover:bg-gray-50/30 transition-colors">
                              <td className="px-8 py-3 text-xs font-bold text-gray-600">{pt}</td>
                              <td className="px-8 py-3 text-right">
                                <input 
                                  type="number" 
                                  className="w-20 px-3 py-1.5 rounded-xl border border-gray-100 bg-white/50 text-right text-xs font-black text-gray-900 focus:border-brand-500 outline-none transition-all shadow-sm"
                                  value={priceConfig.pricesByRange[selectedRangeId].innerPrices[size][pt].general}
                                  onChange={e => {
                                    const val = parseInt(e.target.value) || 0;
                                    setPriceConfig(prev => ({
                                      ...prev,
                                      pricesByRange: {
                                        ...prev.pricesByRange,
                                        [selectedRangeId]: {
                                          ...prev.pricesByRange[selectedRangeId],
                                          innerPrices: {
                                            ...prev.pricesByRange[selectedRangeId].innerPrices,
                                            [size]: {
                                              ...prev.pricesByRange[selectedRangeId].innerPrices[size],
                                              [pt]: {
                                                ...prev.pricesByRange[selectedRangeId].innerPrices[size][pt],
                                                general: val
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }));
                                  }}
                                />
                              </td>
                              <td className="px-8 py-3 text-right">
                                <input 
                                  type="number" 
                                  className="w-20 px-3 py-1.5 rounded-xl border border-gray-100 bg-white/50 text-right text-xs font-black text-gray-900 focus:border-brand-500 outline-none transition-all shadow-sm"
                                  value={priceConfig.pricesByRange[selectedRangeId].innerPrices[size][pt].special}
                                  onChange={e => {
                                    const val = parseInt(e.target.value) || 0;
                                    setPriceConfig(prev => ({
                                      ...prev,
                                      pricesByRange: {
                                        ...prev.pricesByRange,
                                        [selectedRangeId]: {
                                          ...prev.pricesByRange[selectedRangeId],
                                          innerPrices: {
                                            ...prev.pricesByRange[selectedRangeId].innerPrices,
                                            [size]: {
                                              ...prev.pricesByRange[selectedRangeId].innerPrices[size],
                                              [pt]: {
                                                ...prev.pricesByRange[selectedRangeId].innerPrices[size][pt],
                                                special: val
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }));
                                  }}
                                />
                              </td>
                              <td className="px-8 py-3 text-right">
                                <input 
                                  type="number" 
                                  disabled={!selectedCompanyId}
                                  placeholder={!selectedCompanyId ? "–" : ""}
                                  className={`w-20 px-3 py-1.5 rounded-xl border text-right text-xs font-black focus:ring-1 focus:ring-brand-500 outline-none transition-all ${
                                    !selectedCompanyId ? 'bg-gray-50 border-transparent text-gray-300' : 'bg-brand-50 border-brand-100 text-brand-600'
                                  }`}
                                  value={selectedCompanyId ? (priceConfig.pricesByRange[selectedRangeId].innerPrices[size][pt].separate[selectedCompanyId] || 0) : ''}
                                  onChange={e => {
                                    if (!selectedCompanyId) return;
                                    const val = parseInt(e.target.value) || 0;
                                      setPriceConfig(prev => ({
                                        ...prev,
                                        pricesByRange: {
                                          ...prev.pricesByRange,
                                          [selectedRangeId]: {
                                            ...prev.pricesByRange[selectedRangeId],
                                            innerPrices: {
                                              ...prev.pricesByRange[selectedRangeId].innerPrices,
                                              [size]: {
                                                ...prev.pricesByRange[selectedRangeId].innerPrices[size],
                                                [pt]: {
                                                  ...prev.pricesByRange[selectedRangeId].innerPrices[size][pt],
                                                  separate: {
                                                    ...prev.pricesByRange[selectedRangeId].innerPrices[size][pt].separate,
                                                    [selectedCompanyId]: val
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }));
                                  }}
                                />
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Cover Prices */}
              <section className="glass-card rounded-[2.5rem] overflow-hidden border-brand-50/50 shadow-2xl shadow-brand-100/10">
                <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white text-gray-900">
                  <div>
                    <h3 className="text-xl font-black tracking-tight">표지 제작 단가</h3>
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mt-1">Cover Base Pricing</p>
                  </div>
                  <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600">
                    <Layers className="w-5 h-5" />
                  </div>
                </div>
                <div className="p-8 space-y-8">
                  <div className="p-6 bg-brand-50 rounded-3xl border border-brand-100/50 flex gap-4 items-start translate-x-1">
                    <Info className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-brand-700 leading-relaxed font-bold">
                       본 단가는 <strong className="text-brand-900">스노우 250g / 아트 250g</strong> 기준입니다. 
                       작업물 용지가 달라질 경우 시스템에서 부당 <strong className="text-brand-900">+30원</strong>이 자동 가산됩니다.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">General</label>
                      <input 
                        type="number" 
                        className="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-gray-50/30 text-base font-black text-right text-gray-900 focus:border-brand-500 outline-none shadow-sm transition-all"
                        value={priceConfig.pricesByRange[selectedRangeId].standardCoverPrice.general}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          setPriceConfig(prev => ({
                            ...prev,
                            pricesByRange: {
                              ...prev.pricesByRange,
                              [selectedRangeId]: {
                                ...prev.pricesByRange[selectedRangeId],
                                standardCoverPrice: {
                                  ...prev.pricesByRange[selectedRangeId].standardCoverPrice,
                                  general: val
                                }
                              }
                            }
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Special</label>
                      <input 
                        type="number" 
                        className="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-gray-50/30 text-base font-black text-right text-gray-900 focus:border-brand-500 outline-none shadow-sm transition-all"
                        value={priceConfig.pricesByRange[selectedRangeId].standardCoverPrice.special}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          setPriceConfig(prev => ({
                            ...prev,
                            pricesByRange: {
                              ...prev.pricesByRange,
                              [selectedRangeId]: {
                                ...prev.pricesByRange[selectedRangeId],
                                standardCoverPrice: {
                                  ...prev.pricesByRange[selectedRangeId].standardCoverPrice,
                                  special: val
                                }
                              }
                            }
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em] ml-1">Custom</label>
                      <input 
                        type="number" 
                        disabled={!selectedCompanyId}
                        placeholder={!selectedCompanyId ? "–" : ""}
                        className={`w-full px-6 py-4 rounded-2xl border text-base font-black text-right focus:border-brand-500 outline-none shadow-sm transition-all ${
                          !selectedCompanyId ? 'bg-gray-50 border-transparent text-gray-200' : 'bg-brand-50 border-brand-100 text-brand-600'
                        }`}
                        value={selectedCompanyId ? (priceConfig.pricesByRange[selectedRangeId].standardCoverPrice.separate[selectedCompanyId] || 0) : ''}
                        onChange={e => {
                          if (!selectedCompanyId) return;
                          const val = parseInt(e.target.value) || 0;
                          setPriceConfig(prev => ({
                            ...prev,
                            pricesByRange: {
                              ...prev.pricesByRange,
                              [selectedRangeId]: {
                                ...prev.pricesByRange[selectedRangeId],
                                standardCoverPrice: {
                                  ...prev.pricesByRange[selectedRangeId].standardCoverPrice,
                                  separate: {
                                    ...prev.pricesByRange[selectedRangeId].standardCoverPrice.separate,
                                    [selectedCompanyId]: val
                                  }
                                }
                              }
                            }
                          }));
                        }}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Extra Charges */}
              <section className="glass-card rounded-[2.5rem] overflow-hidden border-brand-50/50 shadow-2xl shadow-brand-100/10 lg:col-span-2">
                <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white text-gray-900">
                  <div>
                    <h3 className="text-xl font-black tracking-tight">추가 옵션 단가</h3>
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mt-1">Extra Charges & Post-Processing</p>
                  </div>
                  <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600">
                    <Settings className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-8 space-y-12">
                  {/* Basic Extra Charges */}
                  <div>
                    <div className="flex items-center gap-3 mb-8">
                       <div className="w-1.5 h-6 bg-brand-500 rounded-full" />
                       <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">Base Modifications</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {[
                        { key: 'doubleSidedPrinting', label: '표지 양면 인쇄' },
                        { key: 'flaps', label: '표지 날개' },
                        { key: 'epoxy', label: '에폭시' },
                      ].map(item => (
                        <div key={item.key} className="p-6 rounded-3xl bg-gray-50/30 border border-gray-100 space-y-4">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block">{item.label}</label>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Global</span>
                              <input 
                                type="number" 
                                className="w-24 px-4 py-3 rounded-xl border border-gray-100 bg-white text-xs font-black text-right focus:border-brand-500 outline-none shadow-sm transition-all"
                                value={priceConfig.pricesByRange[selectedRangeId].extraCharges[item.key]?.general || 0}
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 0;
                                  setPriceConfig(prev => ({
                                    ...prev,
                                    pricesByRange: {
                                      ...prev.pricesByRange,
                                      [selectedRangeId]: {
                                        ...prev.pricesByRange[selectedRangeId],
                                        extraCharges: {
                                          ...prev.pricesByRange[selectedRangeId].extraCharges,
                                          [item.key]: {
                                            ...prev.pricesByRange[selectedRangeId].extraCharges[item.key],
                                            general: val
                                          }
                                        }
                                      }
                                    }
                                  }));
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-4 border-t border-gray-50 pt-3">
                              <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Client</span>
                              <input 
                                type="number" 
                                disabled={!selectedCompanyId}
                                placeholder={!selectedCompanyId ? "–" : ""}
                                className={`w-24 px-4 py-3 rounded-xl border text-xs font-black text-right focus:border-brand-500 outline-none shadow-sm transition-all ${
                                  !selectedCompanyId ? 'bg-gray-50 border-transparent text-gray-200' : 'bg-brand-50 border-brand-100 text-brand-600'
                                }`}
                                value={selectedCompanyId ? (priceConfig.pricesByRange[selectedRangeId].extraCharges[item.key].separate[selectedCompanyId] || 0) : ''}
                                onChange={e => {
                                  if (!selectedCompanyId) return;
                                  const val = parseInt(e.target.value) || 0;
                                  setPriceConfig(prev => ({
                                    ...prev,
                                    pricesByRange: {
                                      ...prev.pricesByRange,
                                      [selectedRangeId]: {
                                        ...prev.pricesByRange[selectedRangeId],
                                        extraCharges: {
                                          ...prev.pricesByRange[selectedRangeId].extraCharges,
                                          [item.key]: {
                                            ...prev.pricesByRange[selectedRangeId].extraCharges[item.key],
                                            separate: {
                                              ...prev.pricesByRange[selectedRangeId].extraCharges[item.key].separate,
                                              [selectedCompanyId]: val
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }));
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Endpaper Options */}
                  <div className="border-t border-gray-100 pt-12">
                    <div className="flex items-center gap-3 mb-8">
                       <div className="w-1.5 h-6 bg-brand-500 rounded-full" />
                       <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">Endpaper Processing</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {['제물면지', '베다인쇄'].map(type => (
                        <div key={type} className="p-8 rounded-[2rem] bg-gray-50/50 border border-gray-100 space-y-6">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest border-b border-gray-100 pb-3 block">{type}</label>
                          <div className="flex gap-6">
                            <div className="flex-1 space-y-2">
                              <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] ml-1">General</span>
                              <input 
                                type="number" 
                                className="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-white text-sm font-black text-right text-gray-900 focus:border-brand-500 outline-none shadow-sm transition-all"
                                value={priceConfig.pricesByRange[selectedRangeId].extraCharges.endpaper[type]?.general || 0}
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 0;
                                  setPriceConfig(prev => ({
                                    ...prev,
                                    pricesByRange: {
                                      ...prev.pricesByRange,
                                      [selectedRangeId]: {
                                        ...prev.pricesByRange[selectedRangeId],
                                        extraCharges: {
                                          ...prev.pricesByRange[selectedRangeId].extraCharges,
                                          endpaper: {
                                            ...prev.pricesByRange[selectedRangeId].extraCharges.endpaper,
                                            [type]: { ...prev.pricesByRange[selectedRangeId].extraCharges.endpaper[type], general: val }
                                          }
                                        }
                                      }
                                    }
                                  }));
                                }}
                              />
                            </div>
                            <div className="flex-1 space-y-2">
                              <span className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em] ml-1">Company</span>
                              <input 
                                type="number" 
                                disabled={!selectedCompanyId}
                                placeholder={!selectedCompanyId ? "–" : ""}
                                className={`w-full px-6 py-4 rounded-2xl border text-sm font-black text-right focus:border-brand-500 outline-none shadow-sm transition-all ${
                                  !selectedCompanyId ? 'bg-gray-100/50 border-transparent text-gray-300' : 'bg-brand-50 border-brand-100 text-brand-600'
                                }`}
                                value={selectedCompanyId ? (priceConfig.pricesByRange[selectedRangeId].extraCharges.endpaper[type]?.separate[selectedCompanyId] || 0) : ''}
                                onChange={e => {
                                  if (!selectedCompanyId) return;
                                  const val = parseInt(e.target.value) || 0;
                                  setPriceConfig(prev => ({
                                    ...prev,
                                    pricesByRange: {
                                      ...prev.pricesByRange,
                                      [selectedRangeId]: {
                                        ...prev.pricesByRange[selectedRangeId],
                                        extraCharges: {
                                          ...prev.pricesByRange[selectedRangeId].extraCharges,
                                          endpaper: {
                                            ...prev.pricesByRange[selectedRangeId].extraCharges.endpaper,
                                            [type]: { 
                                              ...prev.pricesByRange[selectedRangeId].extraCharges.endpaper[type], 
                                              separate: { ...prev.pricesByRange[selectedRangeId].extraCharges.endpaper[type].separate, [selectedCompanyId]: val }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }));
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Foil Options */}
                  <div className="border-t border-gray-100 pt-12">
                    <div className="flex items-center gap-3 mb-8">
                       <div className="w-1.5 h-6 bg-brand-500 rounded-full" />
                       <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">Digital Foil Tech</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {FOIL_TYPES.filter(t => t !== '없음').map(type => (
                        <div key={type} className="p-6 rounded-[2rem] bg-gray-50/20 border border-gray-100 space-y-4">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] block text-center border-b border-gray-100 pb-2">{type}</label>
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest ml-1">Global</span>
                              <input 
                                type="number" 
                                className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-white text-xs font-black text-right text-gray-900 focus:border-brand-500 outline-none"
                                value={priceConfig.pricesByRange[selectedRangeId].extraCharges.foil[type]?.general || 0}
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 0;
                                  setPriceConfig(prev => ({
                                    ...prev,
                                    pricesByRange: {
                                      ...prev.pricesByRange,
                                      [selectedRangeId]: {
                                        ...prev.pricesByRange[selectedRangeId],
                                        extraCharges: {
                                          ...prev.pricesByRange[selectedRangeId].extraCharges,
                                          foil: {
                                            ...prev.pricesByRange[selectedRangeId].extraCharges.foil,
                                            [type]: { ...prev.pricesByRange[selectedRangeId].extraCharges.foil[type], general: val }
                                          }
                                        }
                                      }
                                    }
                                  }));
                                }}
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] font-black text-brand-400 uppercase tracking-widest ml-1">Client</span>
                              <input 
                                type="number" 
                                disabled={!selectedCompanyId}
                                placeholder={!selectedCompanyId ? "–" : ""}
                                className={`w-full px-4 py-3 rounded-xl border text-xs font-black text-right focus:border-brand-500 outline-none ${
                                  !selectedCompanyId ? 'bg-gray-100/30 border-transparent text-gray-300' : 'bg-brand-50 border-brand-100 text-brand-600'
                                }`}
                                value={selectedCompanyId ? (priceConfig.pricesByRange[selectedRangeId].extraCharges.foil[type]?.separate[selectedCompanyId] || 0) : ''}
                                onChange={e => {
                                  if (!selectedCompanyId) return;
                                  const val = parseInt(e.target.value) || 0;
                                  setPriceConfig(prev => ({
                                    ...prev,
                                    pricesByRange: {
                                      ...prev.pricesByRange,
                                      [selectedRangeId]: {
                                        ...prev.pricesByRange[selectedRangeId],
                                        extraCharges: {
                                          ...prev.pricesByRange[selectedRangeId].extraCharges,
                                          foil: {
                                            ...prev.pricesByRange[selectedRangeId].extraCharges.foil,
                                            [type]: { 
                                              ...prev.pricesByRange[selectedRangeId].extraCharges.foil[type], 
                                              separate: { ...prev.pricesByRange[selectedRangeId].extraCharges.foil[type].separate, [selectedCompanyId]: val }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }));
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </React.Fragment>
            ) : (
              <React.Fragment>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Company List */}
                <section className="lg:col-span-1 glass-card rounded-[2.5rem] p-8 flex flex-col bg-white overflow-hidden border-brand-50/50 shadow-2xl shadow-brand-100/10">
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h3 className="text-2xl font-black tracking-tight text-gray-900">거래처 DB</h3>
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mt-1">Client Management</p>
                  </div>
                  <button 
                    id="admin-add-company-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      console.log('Admin: Add Company button clicked');
                      setIsAddingCompany(true);
                      setEditingCompanyId(null);
                      setCompanyForm({ name: '', code: '', priceMode: 'general' });
                    }}
                    className="w-14 h-14 bg-brand-600 text-white rounded-[1.25rem] hover:bg-brand-700 transition-all shadow-xl shadow-brand-100 flex items-center justify-center group active:scale-90"
                  >
                    <Plus className="w-7 h-7 transition-transform group-hover:rotate-90" />
                  </button>
                </div>

                {(isAddingCompany || editingCompanyId) && (
                  <div className="mb-10 p-8 glass-card border-brand-100/50 space-y-6 animate-in fade-in slide-in-from-top-6 duration-700">
                    <div className="flex items-center gap-3">
                       <div className="w-1.5 h-6 bg-brand-500 rounded-full" />
                       <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">
                         {editingCompanyId ? '거래처 정보 수정' : '새 거래처 등록'}
                       </h4>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">거래처명</label>
                        <input 
                          type="text"
                          placeholder="예시: (주)인쇄나라"
                          className="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-gray-50/30 text-sm font-bold outline-none focus:border-brand-500 shadow-sm transition-all focus:bg-white"
                          value={companyForm.name}
                          onChange={e => setCompanyForm(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">거래처 코드</label>
                        <input 
                          type="text"
                          placeholder="A_001"
                          className="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-gray-50/30 text-sm font-mono font-bold outline-none focus:border-brand-500 shadow-sm transition-all focus:bg-white"
                          value={companyForm.code}
                          onChange={e => setCompanyForm(prev => ({ ...prev, code: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-3 pt-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">단가 적용 모드</label>
                        <div className="grid grid-cols-3 gap-3">
                          {['general', 'special', 'separate'].map(mode => (
                            <button
                              key={mode}
                              onClick={() => setCompanyForm(prev => ({ ...prev, priceMode: mode }))}
                              className={`py-3 rounded-2xl border text-[10px] font-black transition-all uppercase tracking-widest ${
                                companyForm.priceMode === mode
                                ? 'bg-brand-600 border-brand-600 text-white shadow-xl shadow-brand-100'
                                : 'bg-white border-gray-200 text-gray-400 hover:border-brand-200 hover:text-brand-600'
                              }`}
                            >
                              {mode === 'general' ? '일반' : mode === 'special' ? '우대' : '별도'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button 
                          id="admin-submit-company-btn"
                          onClick={() => {
                            if (companyForm.name && companyForm.code) {
                              if (editingCompanyId) {
                                // Update existing
                                setPriceConfig(prev => ({
                                  ...prev,
                                  separateCompanies: prev.separateCompanies.map(c => 
                                    c.id === editingCompanyId 
                                    ? { ...c, name: companyForm.name, code: companyForm.code, priceMode: companyForm.priceMode }
                                    : c
                                  )
                                }));
                                alert('거래처 정보가 수정되었습니다.');
                              } else {
                                // Add new
                                const newCompany = { 
                                  id: Math.random().toString(36).substr(2, 9), 
                                  name: companyForm.name, 
                                  code: companyForm.code,
                                  priceMode: companyForm.priceMode
                                };
                                setPriceConfig(prev => ({
                                  ...prev,
                                  separateCompanies: [...prev.separateCompanies, newCompany]
                                }));
                                setSelectedCompanyId(newCompany.id);
                                alert('새 거래처가 등록되었습니다.');
                              }
                              setIsAddingCompany(false);
                              setEditingCompanyId(null);
                            } else {
                              alert('거래처명과 코드를 모두 입력해주세요.');
                            }
                          }}
                          className="flex-1 py-4 bg-brand-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-brand-700 shadow-3xl shadow-brand-100 active:scale-95 transition-all outline-none"
                        >
                          저장
                        </button>
                        <button 
                          onClick={() => {
                            setIsAddingCompany(false);
                            setEditingCompanyId(null);
                          }}
                          className="flex-1 py-4 bg-white border-2 border-gray-100 text-gray-400 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:border-brand-100 hover:text-brand-500 active:scale-95 transition-all"
                        >
                          취소
                        </button>
                      </div>
                  </div>
                )}

                <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2 scrollbar-hide py-2">
                  {priceConfig.separateCompanies.length === 0 ? (
                    <div className="text-center py-24">
                      <div className="w-20 h-20 bg-gray-50 text-gray-200 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                        <User className="w-10 h-10 opacity-20" />
                      </div>
                      <p className="text-sm font-black text-gray-300 uppercase tracking-[0.2em]">Database Empty</p>
                    </div>
                  ) : (
                    priceConfig.separateCompanies.map(company => (
                      <div key={company.id} className="group">
                        {editingCompanyId === company.id ? (
                          <div className="p-8 glass-card border-brand-500/50 space-y-6 shadow-2xl shadow-brand-200/20 animate-in zoom-in-95 duration-400">
                             <div className="flex items-center gap-3">
                               <div className="w-1.5 h-6 bg-brand-500 rounded-full" />
                               <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">Update Client Intel</h4>
                            </div>
                            <div className="space-y-4">
                              <input 
                                type="text"
                                className="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-gray-50/50 text-sm font-bold outline-none focus:border-brand-500 focus:bg-white shadow-sm"
                                value={companyForm.name}
                                onChange={e => setCompanyForm(prev => ({ ...prev, name: e.target.value }))}
                              />
                              <input 
                                type="text"
                                className="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-gray-50/50 text-sm font-mono font-bold outline-none focus:border-brand-500 focus:bg-white shadow-sm"
                                value={companyForm.code}
                                onChange={e => setCompanyForm(prev => ({ ...prev, code: e.target.value }))}
                              />
                            </div>
                            <div className="flex gap-3 pt-4">
                              <button 
                                onClick={() => {
                                  if (companyForm.name && companyForm.code) {
                                    setPriceConfig(prev => ({
                                      ...prev,
                                      separateCompanies: prev.separateCompanies.map(c => 
                                        c.id === company.id ? { ...c, name: companyForm.name, code: companyForm.code, priceMode: companyForm.priceMode } : c
                                      )
                                    }));
                                    setEditingCompanyId(null);
                                  }
                                }}
                                className="flex-1 py-4 bg-brand-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-100"
                              >
                                Save Changes
                              </button>
                              <button 
                                onClick={() => setEditingCompanyId(null)}
                                className="flex-1 py-4 bg-white border-2 border-gray-100 text-gray-400 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em]"
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            onClick={() => setSelectedCompanyId(company.id)}
                            className={`p-6 rounded-[2.5rem] border-2 transition-all duration-700 relative cursor-pointer active:scale-[0.98] ${
                              selectedCompanyId === company.id
                              ? 'border-brand-600 bg-white shadow-[0_20px_50px_-12px_rgba(79,70,229,0.25)]'
                              : 'border-white bg-gray-50/50 hover:bg-white hover:border-brand-100 hover:shadow-xl hover:shadow-brand-100/10'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-5">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-700 ${
                                  selectedCompanyId === company.id ? 'bg-brand-600 text-white shadow-xl shadow-brand-100 rotate-6' : 'bg-white text-gray-300'
                                }`}>
                                  <User className="w-7 h-7" />
                                </div>
                                <div>
                                  <div className={`font-black text-lg tracking-tight transition-colors ${
                                    selectedCompanyId === company.id ? 'text-gray-900' : 'text-gray-500'
                                  }`}>{company.name}</div>
                                  <div className="flex items-center gap-3 mt-1.5">
                                    <span className="text-[11px] text-gray-400 font-mono font-black tracking-widest opacity-60">#{company.code}</span>
                                    <div className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
                                    <span className={`text-[9px] px-2.5 py-1 rounded-xl font-black uppercase tracking-[0.15em] border ${
                                      company.priceMode === 'separate' ? 'bg-brand-50 border-brand-100 text-brand-700' :
                                      company.priceMode === 'special' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                      'bg-gray-100 border-gray-200 text-gray-500'
                                    }`}>
                                      {company.priceMode === 'separate' ? '별도' : company.priceMode === 'special' ? '우대' : '일반'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {selectedCompanyId === company.id && (
                                <div className="flex flex-col gap-2 animate-in slide-in-from-right-4 duration-500">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingCompanyId(company.id);
                                      setIsAddingCompany(true);
                                      setCompanyForm({ name: company.name, code: company.code, priceMode: company.priceMode || 'general' });
                                    }}
                                    className="w-10 h-10 flex items-center justify-center text-brand-600 bg-brand-50 rounded-xl hover:bg-brand-600 hover:text-white transition-all shadow-sm"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm('정말 삭제하시겠습니까?')) {
                                        setPriceConfig(prev => ({
                                          ...prev,
                                          separateCompanies: prev.separateCompanies.filter(c => c.id !== company.id)
                                        }));
                                        setSelectedCompanyId(null);
                                      }
                                    }}
                                    className="w-10 h-10 flex items-center justify-center text-red-500 bg-red-50 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

              {/* Company Detail / Quick Actions */}
              <section className="lg:col-span-2 space-y-12">
                {selectedCompanyId ? (
                  <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000">
                    <div className="glass-card rounded-[4rem] p-16 text-center bg-white border-brand-50/50 shadow-3xl shadow-brand-100/10 relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-64 h-64 bg-brand-50/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 -z-10" />
                       <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-50/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 -z-10" />
                       
                      <div className="w-32 h-32 bg-brand-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-12 shadow-[0_25px_60px_-15px_rgba(79,70,229,0.5)] rotate-6 hover:rotate-0 transition-all duration-700 transform hover:scale-110">
                        <User className="w-14 h-14" />
                      </div>
                      <h3 className="text-5xl font-black text-gray-900 tracking-tighter mb-4">
                        {priceConfig.separateCompanies.find(c => c.id === selectedCompanyId)?.name}
                      </h3>
                      <div className="flex items-center justify-center gap-4 mb-14">
                        <span className="text-sm font-black text-gray-300 uppercase tracking-[0.4em]">Integrated Client ID: {priceConfig.separateCompanies.find(c => c.id === selectedCompanyId)?.code}</span>
                        <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse" />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
                        <button 
                          onClick={() => setAdminTab('prices')}
                          className="flex items-center justify-center gap-4 p-8 bg-brand-600 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-[0.2em] hover:bg-brand-700 transition-all shadow-3xl shadow-brand-200 active:scale-95 group overflow-hidden relative"
                        >
                          <Calculator className="w-7 h-7 transition-transform group-hover:scale-125 z-10" />
                          <span className="z-10">Configure Pricing Matrix</span>
                          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        </button>
                        <button 
                          onClick={() => copyFromGeneral(selectedCompanyId)}
                          className="flex items-center justify-center gap-4 p-8 bg-white border-2 border-gray-100 text-gray-800 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.2em] hover:border-brand-200 hover:text-brand-600 transition-all shadow-xl shadow-brand-100/10 active:scale-95 group"
                        >
                          <Copy className="w-7 h-7 transition-transform group-hover:scale-125" />
                          Duplicate Baseline
                        </button>
                      </div>
                    </div>

                    <div className="mt-12 glass-card rounded-[3rem] p-12 bg-white border-brand-50/50 shadow-2xl flex gap-10 items-start">
                      <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center shadow-xl shadow-brand-100/30 shrink-0">
                        <Info className="w-8 h-8 text-brand-600" />
                      </div>
                      <div className="space-y-6">
                        <h4 className="text-2xl font-black text-gray-900 tracking-tight">거래처별 개별 단가 최적화 가이드</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                          {[
                            { title: "Baseline Sync", text: "일반 단가 복사 시 현재 설정된 전역 기준 단가가 해당 거래처의 1순위 데이터로 주입됩니다." },
                            { title: "Priority Engine", text: "VIP 등급 업체는 단가 조회 시 전역 설정을 무시하고 이 섹션에서 설정한 개별 데이터를 우선 호출합니다." },
                            { title: "ID Integrity", text: "거래처 코드는 주문 생성 및 정산 프로세스에서 데이터를 연결하는 핵심 식별자입니다." },
                            { title: "Smart Overrides", text: "특정 도수나 부수에 대해서만 예외적인 단가를 적용하려면 Pricing Matrix에서 직접 오버라이드를 수행하세요." }
                          ].map((guide, i) => (
                            <div key={i} className="space-y-2">
                              <div className="text-[10px] font-black text-brand-500 uppercase tracking-widest">{guide.title}</div>
                              <p className="text-xs font-bold text-gray-500 leading-relaxed">{guide.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="glass-card rounded-[4rem] text-center flex flex-col items-center justify-center h-full min-h-[600px] bg-white border-brand-50/20 shadow-2xl shadow-brand-100/5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-100 to-transparent opacity-50" />
                    <div className="relative mb-12">
                      <div className="w-40 h-40 bg-gray-50/50 text-gray-200 rounded-[3rem] flex items-center justify-center shadow-inner">
                        <User className="w-20 h-20 opacity-10" />
                      </div>
                      <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white rounded-3xl shadow-2xl flex items-center justify-center border border-gray-50">
                        <Search className="w-7 h-7 text-gray-200" />
                      </div>
                    </div>
                    <h3 className="text-3xl font-black text-gray-300 tracking-tight mb-6 uppercase tracking-widest">거래처를 선택해주세요</h3>
                    <p className="text-gray-400 font-bold max-w-md leading-relaxed text-base opacity-60">
                      왼쪽 리스트에서 거래처를 선택하여 개별 단가 테이블 활성화,<br/>
                      계정 연동 정보 수정 및 전용 관리 도구를 이용하십시오.
                    </p>
                    <div className="mt-12 flex gap-2">
                       {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-gray-100" />)}
                    </div>
                  </div>
                )}
              </section>
            </React.Fragment>
          )}
        </div>
      ) : userView === 'customers' ? (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-12 duration-1000 p-8">
           <div className="flex border-b border-gray-100 pb-12 mb-12 items-baseline gap-4">
             <h2 className="text-6xl font-black text-gray-900 tracking-tighter">거래처 관리</h2>
             <span className="text-gray-300 font-black text-sm uppercase tracking-[0.4em]">Integrated Database</span>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <section className="lg:col-span-1 glass-card rounded-[2.5rem] p-8 flex flex-col bg-white border-brand-50/50 shadow-2xl shadow-brand-100/10">
                  <div className="flex items-center justify-between mb-10">
                    <div>
                      <h3 className="text-2xl font-black tracking-tight text-gray-900">거래처 DB</h3>
                      <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mt-1">Client Management</p>
                    </div>
                    <button 
                      id="add-company-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        console.log('Customer View: Add Company button clicked');
                        setIsAddingCompany(true);
                        setEditingCompanyId(null);
                        setCompanyForm({ name: '', code: '', priceMode: 'general' });
                      }}
                      className="w-14 h-14 bg-brand-600 text-white rounded-[1.25rem] hover:bg-brand-700 transition-all shadow-xl shadow-brand-100 flex items-center justify-center group active:scale-90"
                    >
                      <Plus className="w-7 h-7 transition-transform group-hover:rotate-90" />
                    </button>
                  </div>

                  {(isAddingCompany || editingCompanyId) && (
                    <div className="mb-10 p-8 glass-card border-brand-100/50 space-y-6 animate-in fade-in slide-in-from-top-6 duration-700">
                      <div className="flex items-center gap-3">
                         <div className="w-1.5 h-6 bg-brand-500 rounded-full" />
                         <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">{editingCompanyId ? '거래처 정보 수정' : '새 거래처 등록'}</h4>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">거래처명</label>
                          <input 
                            type="text"
                            placeholder="예시: (주)인쇄나라"
                            className="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-gray-50/30 text-sm font-bold outline-none focus:border-brand-500 shadow-sm transition-all focus:bg-white"
                            value={companyForm.name}
                            onChange={e => setCompanyForm(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">거래처 코드</label>
                          <input 
                            type="text"
                            placeholder="A_001"
                            className="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-gray-50/30 text-sm font-mono font-bold outline-none focus:border-brand-500 shadow-sm transition-all focus:bg-white"
                            value={companyForm.code}
                            onChange={e => setCompanyForm(prev => ({ ...prev, code: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-3 pt-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">단가 적용 모드</label>
                          <div className="grid grid-cols-3 gap-3">
                            {['general', 'special', 'separate'].map(mode => (
                              <button
                                key={mode}
                                onClick={() => setCompanyForm(prev => ({ ...prev, priceMode: mode }))}
                                className={`py-3 rounded-2xl border text-[10px] font-black transition-all uppercase tracking-widest ${
                                  companyForm.priceMode === mode
                                  ? 'bg-brand-600 border-brand-600 text-white shadow-xl shadow-brand-100'
                                  : 'bg-white border-gray-200 text-gray-400 hover:border-brand-200 hover:text-brand-600'
                                }`}
                              >
                                {mode === 'general' ? '일반' : mode === 'special' ? '우대' : '별도'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button 
                          id="user-submit-company-btn"
                          onClick={() => {
                            if (companyForm.name && companyForm.code) {
                              if (editingCompanyId) {
                                setPriceConfig(prev => ({
                                  ...prev,
                                  separateCompanies: prev.separateCompanies.map(c => 
                                    c.id === editingCompanyId 
                                    ? { ...c, name: companyForm.name, code: companyForm.code, priceMode: companyForm.priceMode }
                                    : c
                                  )
                                }));
                                alert('거래처 정보가 수정되었습니다.');
                              } else {
                                const newCompany = { 
                                  id: Math.random().toString(36).substr(2, 9), 
                                  name: companyForm.name, 
                                  code: companyForm.code,
                                  priceMode: companyForm.priceMode
                                };
                                setPriceConfig(prev => ({
                                  ...prev,
                                  separateCompanies: [...prev.separateCompanies, newCompany]
                                }));
                                setSelectedCompanyId(newCompany.id);
                                alert('새 거래처가 등록되었습니다.');
                              }
                              setIsAddingCompany(false);
                              setEditingCompanyId(null);
                            } else {
                              alert('거래처명과 코드를 모두 입력해주세요.');
                            }
                          }}
                          className="flex-1 py-4 bg-brand-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-brand-700 shadow-3xl shadow-brand-100 active:scale-95 transition-all outline-none"
                        >
                          저장
                        </button>
                        <button 
                          onClick={() => {
                            setIsAddingCompany(false);
                            setEditingCompanyId(null);
                          }}
                          className="flex-1 py-4 bg-white border-2 border-gray-100 text-gray-400 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:border-brand-100 hover:text-brand-500 active:scale-95 transition-all"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2 scrollbar-hide py-2">
                    {priceConfig.separateCompanies.length === 0 ? (
                      <div className="text-center py-24">
                        <div className="w-20 h-20 bg-gray-50 text-gray-200 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                          <User className="w-10 h-10 opacity-20" />
                        </div>
                        <p className="text-sm font-black text-gray-300 uppercase tracking-[0.2em]">등록된 거래처가 없습니다</p>
                      </div>
                    ) : (
                      priceConfig.separateCompanies.map(company => (
                        <div 
                          key={company.id} 
                          onClick={() => setSelectedCompanyId(company.id)} 
                          className={`p-6 rounded-[2rem] border-2 cursor-pointer transition-all flex items-center justify-between ${
                            selectedCompanyId === company.id 
                            ? 'border-brand-600 bg-white shadow-xl shadow-brand-100/10' 
                            : 'border-white bg-gray-50/50 hover:bg-white'
                          }`}
                        >
                           <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedCompanyId === company.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                <User className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="font-black text-gray-900">{company.name}</div>
                                <div className="text-[10px] text-gray-400 font-bold mt-0.5">#{company.code}</div>
                              </div>
                           </div>
                           
                           {selectedCompanyId === company.id && (
                             <div className="flex gap-2 animate-in slide-in-from-right-4 duration-500">
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setEditingCompanyId(company.id);
                                   setIsAddingCompany(true);
                                   setCompanyForm({ name: company.name, code: company.code, priceMode: company.priceMode || 'general' });
                                 }}
                                 className="w-8 h-8 flex items-center justify-center text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-600 hover:text-white transition-all"
                               >
                                 <Edit2 className="w-3.5 h-3.5" />
                               </button>
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   if (confirm('정말 삭제하시겠습니까?')) {
                                     setPriceConfig(prev => ({
                                       ...prev,
                                       separateCompanies: prev.separateCompanies.filter(c => c.id !== company.id)
                                     }));
                                     setSelectedCompanyId(null);
                                   }
                                 }}
                                 className="w-8 h-8 flex items-center justify-center text-red-500 bg-red-50 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                               >
                                 <Trash2 className="w-3.5 h-3.5" />
                               </button>
                             </div>
                           )}
                        </div>
                      ))
                    )}
                  </div>
              </section>
              <section className="lg:col-span-2">
                 {selectedCompanyId ? (
                   <div className="glass-card rounded-[3rem] p-12 bg-white border-brand-50/50 shadow-2xl">
                      <div className="flex items-center justify-between mb-8">
                         <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-brand-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand-100">
                               <User className="w-8 h-8" />
                            </div>
                            <div>
                               <h3 className="text-3xl font-black text-gray-900">{priceConfig.separateCompanies.find(c => c.id === selectedCompanyId)?.name}</h3>
                               <p className="text-xs font-black text-gray-300 uppercase tracking-widest mt-1">Client ID: {priceConfig.separateCompanies.find(c => c.id === selectedCompanyId)?.code}</p>
                            </div>
                         </div>
                      </div>
                   </div>
                 ) : (
                   <div className="h-full min-h-[400px] glass-card rounded-[3rem] bg-white border-brand-50/20 flex flex-col items-center justify-center text-center">
                      <User className="w-16 h-16 text-gray-200 mb-4" />
                      <h4 className="text-xl font-black text-gray-300 uppercase tracking-widest">Select Client</h4>
                   </div>
                 )}
              </section>
           </div>
        </div>
      ) : userView === 'orders' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-gray-100 pb-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-brand-600 font-bold mb-1">
                  <div className="w-8 h-8 bg-brand-100 rounded-xl flex items-center justify-center">
                    <History className="w-5 h-5" />
                  </div>
                  <span className="text-sm uppercase tracking-[0.2em]">Management</span>
                </div>
                <h2 className="text-4xl font-black text-gray-900 tracking-tight">주문 내역 및 데이터 관리</h2>
                <p className="text-gray-400 text-sm font-medium">과거 견적 이력을 조회하고 엑셀 데이터로 가공할 수 있습니다.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <FilterBar 
                  searchTerm={orderSearchTerm}
                  setSearchTerm={setOrderSearchTerm}
                  startDate={orderStartDate}
                  setStartDate={setOrderStartDate}
                  endDate={orderEndDate}
                  setEndDate={setOrderEndDate}
                />
                <button 
                  onClick={() => setUserView('quote')}
                  className="px-8 py-3.5 bg-brand-600 text-white rounded-2xl font-bold text-sm hover:bg-brand-700 transition-all shadow-xl shadow-brand-100 flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  새 견적 작성
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
              <button onClick={exportOrderListExcel} className="p-4 bg-white border border-gray-100 rounded-2xl hover:border-emerald-200 hover:bg-emerald-50/30 transition-all text-left group">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Download className="w-5 h-5" />
                </div>
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Export Data</p>
                <h4 className="font-bold text-sm text-gray-700">목록 내보내기 (.xlsx)</h4>
              </button>
              
              <button onClick={exportOrdersToExcelBackup} className="p-4 bg-white border border-gray-100 rounded-2xl hover:border-brand-200 hover:bg-brand-50/30 transition-all text-left group">
                <div className="w-10 h-10 bg-brand-100 text-brand-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Save className="w-5 h-5" />
                </div>
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">System Backup</p>
                <h4 className="font-bold text-sm text-gray-700">엑셀 백업 (.xlsx)</h4>
              </button>

              <label className="p-4 bg-white border border-gray-100 rounded-2xl hover:border-brand-200 hover:bg-brand-50/30 transition-all text-left group cursor-pointer">
                <div className="w-10 h-10 bg-brand-100 text-brand-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Restore Data</p>
                <h4 className="font-bold text-sm text-gray-700">엑셀 불러오기 (.xlsx)</h4>
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) importOrdersFromExcel(file); }} />
              </label>

              <button onClick={() => setIsPasteModalOpen(true)} className="p-4 bg-white border border-gray-100 rounded-2xl hover:border-brand-200 hover:bg-brand-50/30 transition-all text-left group">
                <div className="w-10 h-10 bg-brand-100 text-brand-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Copy className="w-5 h-5" />
                </div>
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Text Sync</p>
                <h4 className="font-bold text-sm text-gray-700">텍스트 붙여넣기</h4>
              </button>
            </div>

            <div className="glass-card rounded-[2.5rem] overflow-hidden shadow-2xl shadow-brand-100/10">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-brand-600 text-white">
                      <th className="px-5 py-5 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">주문일</th>
                      <th className="px-5 py-5 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">발주처</th>
                      <th className="px-5 py-5 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">도서명</th>
                      <th className="px-5 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-right whitespace-nowrap">부수/P</th>
                      <th className="px-5 py-5 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">규격</th>
                      <th className="px-5 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-center whitespace-nowrap">상태</th>
                      <th className="px-5 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-center whitespace-nowrap">문서</th>
                      <th className="px-5 py-5 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">용지사양</th>
                      <th className="px-5 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-center whitespace-nowrap">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white/50 backdrop-blur-md">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-32 text-center">
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center mb-2">
                              <List className="w-8 h-8 text-gray-200" />
                            </div>
                            <p className="text-gray-400 font-bold">{orderSearchTerm ? '일치하는 검색 결과가 없습니다.' : '아직 등록된 주문 내역이 없습니다.'}</p>
                            <button onClick={() => setOrderSearchTerm('')} className="text-xs font-black text-brand-600 hover:underline uppercase tracking-widest">Clear Filters</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order, index) => {
                        const totalPages = order.innerSections.reduce((sum, s) => sum + s.pages, 0);
                        const innerPapers = Array.from(new Set(order.innerSections.map(s => s.paper))).join(', ');
                        
                        return (
                          <tr key={`${order.id}-${index}`} className="hover:bg-brand-50/30 transition-colors group">
                            <td className="px-5 py-5">
                              <div className="text-[10px] text-gray-400 font-black mb-1 uppercase opacity-50">{parseOrderDate(order.orderDate).getFullYear()}</div>
                              <div className="text-xs font-bold text-gray-700 whitespace-nowrap">{parseOrderDate(order.orderDate).toLocaleDateString()}</div>
                            </td>
                            <td className="px-5 py-5">
                              <div className="text-xs font-black text-brand-600/80 mb-1 tracking-tight">{order.companyInfo.publisherName || '일반고객'}</div>
                              <div className="text-[10px] font-bold text-gray-400 truncate max-w-[100px]">{order.id.split('-')[0]}</div>
                            </td>
                            <td className="px-5 py-5 min-w-[200px]">
                              <div className="text-sm font-black text-gray-900 group-hover:text-brand-600 transition-colors leading-tight">{order.orderName}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-bold">{order.binding}</span>
                                {order.cover.hasFlaps && <span className="text-[10px] px-1.5 py-0.5 bg-brand-50 rounded text-brand-600 font-bold">날개</span>}
                              </div>
                            </td>
                            <td className="px-5 py-5 text-right">
                              <div className="text-sm font-black text-gray-900">{order.quantity.toLocaleString()}<span className="text-[10px] ml-0.5">부</span></div>
                              <div className="text-[10px] font-bold text-gray-400">{totalPages}P</div>
                            </td>
                            <td className="px-5 py-5">
                              <div className="text-xs font-bold text-gray-700">{order.size}</div>
                              {order.customSize && <div className="text-[10px] text-gray-400 font-mono italic">{order.customSize.width}x{order.customSize.height}</div>}
                            </td>
                            <td className="px-5 py-5 text-center">
                              <div className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                order.status === '출고 완료' ? 'bg-emerald-100 text-emerald-700' :
                                order.status === '대기' ? 'bg-gray-100 text-gray-500' :
                                'bg-brand-100 text-brand-700'
                              }`}>
                                {order.status}
                              </div>
                            </td>
                            <td className="px-5 py-5">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => exportWorkOrderExcel(order)} className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-lg text-gray-400 hover:bg-brand-600 hover:text-white transition-all shadow-sm" title="작업지시서">
                                  <FileText className="w-4 h-4" />
                                </button>
                                <button onClick={() => exportQuoteExcel(order)} className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-lg text-gray-400 hover:bg-brand-600 hover:text-white transition-all shadow-sm" title="견적서">
                                  <Calculator className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                            <td className="px-5 py-5">
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 opacity-50">COVER & INNER</div>
                              <div className="text-[11px] font-bold text-gray-600 truncate max-w-[150px]">{order.cover.paper} / {innerPapers}</div>
                            </td>
                            <td className="px-5 py-5">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => loadOrder(order)} className="w-8 h-8 flex items-center justify-center text-brand-600 hover:bg-brand-100 rounded-xl transition-all" title="불러오기">
                                  <Check className="w-4 h-4 shadow-sm" />
                                </button>
                                <button onClick={() => editOrder(order)} className="w-8 h-8 flex items-center justify-center text-brand-600 hover:bg-brand-100 rounded-xl transition-all" title="수정">
                                  <Edit2 className="w-4 h-4 shadow-sm" />
                                </button>
                                <button onClick={() => deleteOrder(order.id)} className="w-8 h-8 flex items-center justify-center text-red-600 hover:bg-red-100 rounded-xl transition-all" title="삭제">
                                  <Trash2 className="w-4 h-4 shadow-sm" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-card rounded-[2.5rem] p-10 border-brand-100 bg-brand-50/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Info className="w-32 h-32 text-brand-900" />
              </div>
              <div className="relative z-10 flex flex-col md:flex-row md:items-start gap-8">
                 <div className="w-16 h-16 bg-brand-600 text-white rounded-[1.5rem] flex items-center justify-center flex-shrink-0 shadow-xl shadow-brand-200">
                  <Info className="w-8 h-8" />
                </div>
                <div className="space-y-4">
                  <h4 className="text-2xl font-black text-brand-950 tracking-tight">주문 데이터 관리 가이드</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    <div className="space-y-2">
                       <h5 className="font-black text-brand-800 text-sm uppercase tracking-widest flex items-center gap-2">
                         <div className="w-1.5 h-1.5 bg-brand-600 rounded-full" />
                         DASHBOARD TIPS
                       </h5>
                       <ul className="text-sm text-brand-900/70 space-y-2 leading-relaxed">
                         <li><strong className="text-brand-950 font-bold">불러오기:</strong> 클릭 즉시 해당 견적 설정이 폼에 적용되어 신규 견적을 바로 시작할 수 있습니다.</li>
                         <li><strong className="text-brand-950 font-bold">수정하기:</strong> 기존 주문 정보를 업데이트합니다. (수정 모드 진입)</li>
                       </ul>
                    </div>
                    <div className="space-y-2">
                       <h5 className="font-black text-brand-800 text-sm uppercase tracking-widest flex items-center gap-2">
                         <div className="w-1.5 h-1.5 bg-brand-600 rounded-full" />
                         SYSTEM NOTES
                       </h5>
                       <ul className="text-sm text-brand-900/70 space-y-2 leading-relaxed">
                         <li>목록은 로컬 브라우저에 저장됩니다. 브라우저 캐시 삭제 시 데이터가 소실될 수 있으니 정기적으로 <strong className="text-brand-950 font-bold">엑셀 백업</strong>을 진행해 주세요.</li>
                       </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : userView === 'sales' ? (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-gray-100 pb-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-brand-600 font-bold mb-1">
                   <div className="w-8 h-8 bg-brand-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <span className="text-sm uppercase tracking-[0.2em]">Analytics</span>
                </div>
                <h2 className="text-4xl font-black text-gray-900 tracking-tight">매출 현황 및 통계</h2>
                <p className="text-gray-400 text-sm font-medium">데이터 기반의 매출 통찰력을 제공합니다.</p>
              </div>
              <FilterBar 
                searchTerm={orderSearchTerm}
                setSearchTerm={setOrderSearchTerm}
                startDate={orderStartDate}
                setStartDate={setOrderStartDate}
                endDate={orderEndDate}
                setEndDate={setOrderEndDate}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="glass-card p-10 bg-brand-600 shadow-2xl shadow-brand-200 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-125 transition-transform duration-500">
                  <TrendingUp className="w-24 h-24 text-white" />
                </div>
                <div className="relative z-10">
                  <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">Total Revenue</p>
                  <h3 className="text-4xl font-black text-white tracking-tight">
                    ₩{filteredOrders.filter(o => o.status === '출고 완료').reduce((sum, o) => sum + o.totalPrice, 0).toLocaleString()}
                  </h3>
                  <div className="mt-6 flex items-center gap-2 text-[10px] font-bold text-white/70">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    LIVE PERFORMANCE DATA
                  </div>
                </div>
              </div>

              <div className="glass-card p-10 relative overflow-hidden group border-brand-100">
                 <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-125 transition-transform duration-500">
                  <CheckCircle2 className="w-24 h-24 text-brand-600" />
                </div>
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-2">Orders Completed</p>
                <h3 className="text-4xl font-black text-gray-900 tracking-tight">
                  {filteredOrders.filter(o => o.status === '출고 완료').length}<span className="text-lg ml-1 text-gray-400">건</span>
                </h3>
                <p className="mt-4 text-xs font-bold text-gray-400">출고 완료 시점 기준 집계</p>
              </div>

              <div className="glass-card p-10 relative overflow-hidden group border-brand-100">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-125 transition-transform duration-500">
                  <Calculator className="w-24 h-24 text-brand-600" />
                </div>
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-2">Average Order Value</p>
                <h3 className="text-4xl font-black text-gray-900 tracking-tight">
                  ₩{filteredOrders.filter(o => o.status === '출고 완료').length > 0 
                    ? Math.round(filteredOrders.filter(o => o.status === '출고 완료').reduce((sum, o) => sum + o.totalPrice, 0) / filteredOrders.filter(o => o.status === '출고 완료').length).toLocaleString() 
                    : 0}
                </h3>
                <p className="mt-4 text-xs font-bold text-gray-400">데이터 필터 범위 내 평균값</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="glass-card p-8 border-brand-50">
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h4 className="text-xl font-black text-gray-900 tracking-tight">월별 매출 추이</h4>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Monthly Analytics</p>
                  </div>
                  <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(() => {
                      const months = {};
                      filteredOrders.filter(o => o.status === '출고 완료').forEach(o => {
                        const date = new Date(o.orderDate);
                        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                        months[month] = (months[month] || 0) + o.totalPrice;
                      });
                      return Object.entries(months)
                        .map(([name, value]) => ({ name, value }))
                        .sort((a, b) => a.name.localeCompare(b.name));
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} tickFormatter={(value) => `₩${(value / 10000).toLocaleString()}만`} />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                        itemStyle={{ fontWeight: 800, color: '#2563eb' }}
                        labelStyle={{ fontWeight: 900, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '10px', color: '#94a3b8' }}
                        formatter={(value) => [`₩${value.toLocaleString()}`, 'REVENUE']}
                      />
                      <Bar dataKey="value" fill="#2563eb" radius={[12, 12, 0, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card p-8 border-brand-50">
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h4 className="text-xl font-black text-gray-900 tracking-tight">거래처별 매출 비중</h4>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Publisher Segment</p>
                  </div>
                  <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center">
                    <PieChartIcon className="w-5 h-5" />
                  </div>
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(() => {
                          const publishers = {};
                          filteredOrders.filter(o => o.status === '출고 완료').forEach(o => {
                            const name = o.companyInfo.publisherName || '기타';
                            publishers[name] = (publishers[name] || 0) + o.totalPrice;
                          });
                          return Object.entries(publishers)
                            .map(([name, value]) => ({ name, value }))
                            .sort((a, b) => b.value - a.value)
                            .slice(0, 10);
                        })()}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={8}
                        dataKey="value"
                      >
                        {[...Array(10)].map((_, index) => (
                          <Cell key={`cell-${index}`} fill={['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'][index % 5]} className="stroke-white stroke-2 focus:outline-none" />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                        itemStyle={{ fontWeight: 800 }}
                        formatter={(value) => [`₩${value.toLocaleString()}`, 'REVENUE']}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 700 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-[2.5rem] overflow-hidden border-brand-50">
              <div className="p-10 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h4 className="text-2xl font-black text-gray-900 tracking-tight">전체 견적 상세 내역</h4>
                  <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">Global Order Ledger</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Found</p>
                    <p className="text-sm font-black text-brand-600">{filteredOrders.length} Records</p>
                  </div>
                  <button 
                    onClick={exportSalesDetailExcel}
                    className="flex items-center gap-2 px-8 py-3.5 bg-brand-600 text-white rounded-2xl font-bold text-sm hover:bg-brand-700 transition-all shadow-xl shadow-brand-100"
                  >
                    <Download className="w-5 h-5" />
                    엑셀 추출
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Date/ID</th>
                      <th className="px-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Entity</th>
                      <th className="px-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Order Name</th>
                      <th className="px-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Status</th>
                      <th className="px-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">Amount</th>
                      <th className="px-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-center">Analysis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-10 py-20 text-center text-gray-300 font-bold italic">No data matching filters.</td>
                      </tr>
                    ) : (
                      filteredOrders.map((order, index) => {
                        const breakdown = calculatePriceBreakdown(order, priceConfig);
                        const isExpanded = expandedOrderId === order.id;
                        
                        return (
                          <React.Fragment key={`${order.id}-${index}`}>
                            <tr className={`hover:bg-brand-50/20 transition-all cursor-pointer ${isExpanded ? 'bg-brand-50/40' : ''}`} onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                              <td className="px-10 py-6">
                                <div className="text-[10px] text-gray-400 font-black mb-1 uppercase opacity-50">{parseOrderDate(order.orderDate).getFullYear()}</div>
                                <div className="text-xs font-bold text-gray-700">{parseOrderDate(order.orderDate).toLocaleDateString()}</div>
                              </td>
                              <td className="px-10 py-6">
                                <div className="text-xs font-black text-brand-600 mb-1">{order.companyInfo.publisherName}</div>
                                <div className="text-[10px] font-bold text-gray-300 truncate max-w-[120px]">{order.id}</div>
                              </td>
                              <td className="px-10 py-6 font-black text-gray-900 leading-tight">{order.orderName}</td>
                              <td className="px-10 py-6">
                                <div className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                  order.status === '출고 완료' ? 'bg-emerald-100 text-emerald-700' :
                                  order.status === '대기' ? 'bg-gray-100 text-gray-500' :
                                  'bg-brand-100 text-brand-700'
                                }`}>
                                  {order.status}
                                </div>
                              </td>
                              <td className="px-10 py-6 text-right font-black text-brand-600 text-lg">₩{order.totalPrice.toLocaleString()}</td>
                              <td className="px-10 py-6 text-center">
                                <button className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${isExpanded ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' : 'text-gray-400 hover:bg-gray-100'}`}>
                                  <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                              </td>
                            </tr>
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.tr 
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                >
                                  <td colSpan={6} className="px-10 py-10 bg-brand-50/10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                      <div className="glass-card p-6 border-white bg-white/60">
                                         <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">INNER CALC</p>
                                         <div className="space-y-2 text-sm">
                                            <div className="flex justify-between font-bold text-gray-600"><span className="opacity-50 font-medium">Base</span> ₩{breakdown.inner.base.toLocaleString()}</div>
                                            <div className="flex justify-between font-bold text-emerald-600"><span className="opacity-50 font-medium">Discount (5%)</span> -₩{breakdown.inner.discount.toLocaleString()}</div>
                                            <div className="border-t border-dashed border-gray-100 mt-4 pt-4 flex justify-between font-black text-brand-600 text-base"><span>Total</span> ₩{breakdown.inner.final.toLocaleString()}</div>
                                         </div>
                                      </div>

                                      <div className="glass-card p-6 border-white bg-white/60">
                                         <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">COVER CALC</p>
                                         <div className="space-y-2 text-sm">
                                            <div className="flex justify-between font-bold text-gray-600"><span className="opacity-50 font-medium">Base</span> ₩{breakdown.cover.base.toLocaleString()}</div>
                                            <div className="flex justify-between font-bold text-emerald-600"><span className="opacity-50 font-medium">Discount (5%)</span> -₩{breakdown.cover.discount.toLocaleString()}</div>
                                            <div className="border-t border-dashed border-gray-100 mt-4 pt-4 flex justify-between font-black text-brand-600 text-base"><span>Total</span> ₩{breakdown.cover.final.toLocaleString()}</div>
                                         </div>
                                      </div>

                                      <div className="glass-card p-6 border-white bg-white/60">
                                         <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">EXTRAS & ENDPAPER</p>
                                         <div className="space-y-2 text-sm">
                                            <div className="flex justify-between font-bold text-gray-600"><span className="opacity-50 font-medium">Endpaper</span> ₩{breakdown.endpaper.final.toLocaleString()}</div>
                                            <div className="flex justify-between font-bold text-gray-600"><span className="opacity-50 font-medium">Add-ons ({breakdown.extras.length})</span> ₩{breakdown.extrasTotal.toLocaleString()}</div>
                                            <div className="border-t border-dashed border-gray-100 mt-4 pt-4 flex justify-between font-black text-brand-600 text-base"><span>Total</span> ₩{(breakdown.endpaper.final + breakdown.extrasTotal).toLocaleString()}</div>
                                         </div>
                                      </div>

                                      <div className="glass-card p-6 bg-brand-600 text-white shadow-xl shadow-brand-100">
                                         <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-4">FINAL QUOTATION</p>
                                         <div className="space-y-3">
                                            <div className="flex justify-between font-black text-2xl"><span>TOTAL</span> ₩{breakdown.total.toLocaleString()}</div>
                                            <div className="bg-white/10 p-3 rounded-xl mt-4">
                                               <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Unit Price ({order.quantity} qty)</p>
                                               <p className="text-xl font-black italic">₩{Math.round(breakdown.total / order.quantity).toLocaleString()}</p>
                                            </div>
                                         </div>
                                      </div>
                                    </div>

                                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                                       <div className="glass-card p-8 bg-gray-50/50 border-gray-100">
                                          <div className="flex items-center gap-2 mb-6">
                                             <div className="w-1.5 h-6 bg-brand-600 rounded-full" />
                                             <h5 className="font-black text-gray-900 uppercase tracking-widest text-xs">Itemized Add-ons</h5>
                                          </div>
                                          <div className="grid grid-cols-1 gap-3">
                                             {breakdown.extras.map((e, i) => (
                                               <div key={i} className="flex justify-between text-xs p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                                                  <span className="font-bold text-gray-600">{e.name}</span>
                                                  <span className="font-black text-brand-600">₩{e.cost.toLocaleString()}</span>
                                               </div>
                                             ))}
                                             {breakdown.extras.length === 0 && <p className="text-xs text-gray-400 font-bold bg-white p-4 rounded-xl text-center border border-dashed border-gray-200">No additional processing options applied</p>}
                                          </div>
                                       </div>
                                       <div className="glass-card p-8 bg-gray-50/50 border-gray-100">
                                          <div className="flex items-center gap-2 mb-6">
                                             <div className="w-1.5 h-6 bg-brand-600 rounded-full" />
                                             <h5 className="font-black text-gray-900 uppercase tracking-widest text-xs">Configuration Summary</h5>
                                          </div>
                                          <div className="space-y-4">
                                             <div className="flex flex-wrap gap-2">
                                                <span className="px-3 py-1.5 bg-white rounded-lg border border-gray-100 text-[10px] font-black text-gray-500 uppercase">{order.size}</span>
                                                <span className="px-3 py-1.5 bg-white rounded-lg border border-gray-100 text-[10px] font-black text-gray-500 uppercase">{order.quantity.toLocaleString()} QTY</span>
                                                <span className="px-3 py-1.5 bg-white rounded-lg border border-gray-100 text-[10px] font-black text-gray-500 uppercase">{breakdown.totalInnerPages}P TOTAL</span>
                                                <span className="px-3 py-1.5 bg-white rounded-lg border border-gray-100 text-[10px] font-black text-gray-500 uppercase">{order.binding}</span>
                                             </div>
                                             <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-bold text-gray-600"><div className="w-1.5 h-1.5 bg-brand-500 rounded-full" />COVER: {order.cover.paper} {order.cover.weight}g ({order.cover.coating})</div>
                                                {order.jacket?.enabled && <div className="flex items-center gap-2 text-xs font-bold text-gray-600"><div className="w-1.5 h-1.5 bg-brand-500 rounded-full" />JACKET: {order.jacket.paper} {order.jacket.weight}g ({order.jacket.coating})</div>}
                                                {order.bellyBand?.enabled && <div className="flex items-center gap-2 text-xs font-bold text-gray-600"><div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />BELLY BAND: {order.bellyBand.paper} {order.bellyBand.weight}g ({order.bellyBand.coating})</div>}
                                             </div>
                                          </div>
                                       </div>
                                    </div>
                                  </td>
                                </motion.tr>
                              )}
                            </AnimatePresence>
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : userView === 'production' ? (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-gray-100 pb-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-brand-600 font-bold mb-1">
                  <div className="w-8 h-8 bg-brand-100 rounded-xl flex items-center justify-center">
                    <Truck className="w-5 h-5" />
                  </div>
                  <span className="text-sm uppercase tracking-[0.2em]">Operations</span>
                </div>
                <h2 className="text-4xl font-black text-gray-900 tracking-tight">제작 현황 관리</h2>
                <p className="text-gray-400 text-sm font-medium">실시간 공정 및 출고 일정을 관리합니다.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="glass-card p-8 border-red-50 bg-white/40">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-lg">오늘 출고</h3>
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Today's Deadline</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {productionSchedules.today.map((order, index) => (
                    <div key={`${order.id}-${index}`} className="p-4 bg-red-50/50 rounded-2xl border border-red-100/50 group hover:shadow-lg hover:shadow-red-50 transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black text-red-600 uppercase tracking-widest px-2 py-0.5 bg-white rounded-full border border-red-100">Urgent</span>
                        <span className="text-xs font-bold text-gray-400">{order.id.split('-')[0]}</span>
                      </div>
                      <h4 className="text-sm font-black text-gray-900 mb-1 group-hover:text-red-700 transition-colors leading-tight">{order.orderName}</h4>
                      <div className="flex items-center justify-between">
                         <span className="text-[11px] font-bold text-gray-400">{order.companyInfo.publisherName}</span>
                         <span className="text-xs font-black text-red-600">{order.status}</span>
                      </div>
                    </div>
                  ))}
                  {productionSchedules.today.length === 0 && (
                    <div className="py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 text-center">
                      <p className="text-xs font-bold text-gray-400 italic">No urgent deliveries today</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-card p-8 border-brand-50 bg-white/40">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-brand-100 text-brand-600 rounded-xl flex items-center justify-center">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-lg">{productionSchedules.tomorrowLabel} 예정</h3>
                    <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Upcoming Shipments</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {productionSchedules.tomorrow.map((order, index) => (
                    <div key={`${order.id}-${index}`} className="p-4 bg-brand-50/50 rounded-2xl border border-brand-100/50 group hover:shadow-lg hover:shadow-brand-50 transition-all">
                      <h4 className="text-sm font-black text-gray-900 mb-1 group-hover:text-brand-700 transition-colors leading-tight">{order.orderName}</h4>
                      <div className="flex items-center justify-between">
                         <span className="text-[11px] font-bold text-gray-400">{order.companyInfo.publisherName}</span>
                         <span className="text-xs font-black text-brand-600">{order.status}</span>
                      </div>
                    </div>
                  ))}
                  {productionSchedules.tomorrow.length === 0 && (
                    <div className="py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 text-center">
                      <p className="text-xs font-bold text-gray-400 italic">No deliveries tomorrow</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-card p-8 border-gray-50 bg-white/40">
                <div className="flex items-center gap-3 mb-6">
                   <div className="w-10 h-10 bg-gray-100 text-gray-400 rounded-xl flex items-center justify-center">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-lg">기타 일정</h3>
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Future Roadmap</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {productionSchedules.later.map((order, index) => (
                    <div key={`${order.id}-${index}`} className="p-4 bg-white rounded-2xl border border-gray-100 group transition-all">
                      <h4 className="text-sm font-black text-gray-900 mb-1 leading-tight">{order.orderName}</h4>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-1.5 font-bold">
                            <span className="text-[10px] text-gray-400">{order.companyInfo.publisherName}</span>
                            <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase">{order.delivery.desiredDate}</span>
                         </div>
                         <span className="text-xs font-black text-gray-400">{order.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-card p-10 bg-brand-600 shadow-2xl shadow-brand-100/20 text-white flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">System Ready</span>
                </div>
                <h4 className="text-3xl font-black tracking-tight">공정 업데이트를 확인하세요</h4>
                <p className="text-white/60 font-bold max-w-lg">모든 제작 공정은 상호 연동되어 있으며, 상태 변경 시 관련 타임라인이 자동으로 갱신됩니다.</p>
              </div>
              <button 
                onClick={() => setUserView('delivery')}
                className="px-10 py-5 bg-white text-brand-600 rounded-3xl font-black uppercase tracking-widest text-sm hover:scale-105 transition-all shadow-2xl active:scale-95"
              >
                Go to Status Center
              </button>
            </div>
          </div>
        ) : userView === 'delivery' ? (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-gray-100 pb-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-brand-600 font-bold mb-1">
                  <div className="w-8 h-8 bg-brand-100 rounded-xl flex items-center justify-center">
                    <Package className="w-5 h-5" />
                  </div>
                  <span className="text-sm uppercase tracking-[0.2em]">Logistics</span>
                </div>
                <h2 className="text-4xl font-black text-gray-900 tracking-tight">출고 공정 관리</h2>
                <p className="text-gray-400 text-sm font-medium">단계별 제작 상태를 추적하고 최종 출고를 확정합니다.</p>
              </div>
              <FilterBar 
                searchTerm={orderSearchTerm}
                setSearchTerm={setOrderSearchTerm}
                startDate={orderStartDate}
                setStartDate={setOrderStartDate}
                endDate={orderEndDate}
                setEndDate={setOrderEndDate}
              />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: '대기', count: filteredOrders.filter(o => o.status === '대기').length, color: 'bg-white border-gray-100 text-gray-400' },
                { label: '공정 완료', count: filteredOrders.filter(o => o.status === '표지인쇄/코팅/후가공 완료' || o.status === '본문 정합 완료').length, color: 'bg-brand-600 border-brand-500 text-white' },
                { label: '제본 완료', count: filteredOrders.filter(o => o.status === '제본 완료').length, color: 'bg-brand-600 border-brand-500 text-white' },
                { label: '출고 완료', count: filteredOrders.filter(o => o.status === '출고 완료').length, color: 'bg-emerald-600 border-emerald-500 text-white' },
              ].map(stat => (
                <div key={stat.label} className={`glass-card p-8 ${stat.color} shadow-xl shadow-brand-100/5 group`}>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-60 group-hover:opacity-100 transition-opacity">{stat.label}</p>
                   <div className="text-4xl font-black">{stat.count}</div>
                </div>
              ))}
            </div>

            <div className="glass-card rounded-[2.5rem] overflow-hidden">
               <div className="p-8 border-b border-gray-100 bg-gray-50/30 flex items-center justify-between">
                  <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest">Active Production Pipeline</h4>
                  <span className="text-xs font-bold text-gray-400">{filteredOrders.filter(o => o.status !== '출고 완료').length} Orders Waiting</span>
               </div>
               <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-10 py-5 text-[10px] font-black uppercase tracking-widest text-gray-300">Phase</th>
                      <th className="px-10 py-5 text-[10px] font-black uppercase tracking-widest text-gray-300">Order Detail</th>
                      <th className="px-10 py-5 text-[10px] font-black uppercase tracking-widest text-gray-300">Specifications</th>
                      <th className="px-10 py-5 text-[10px] font-black uppercase tracking-widest text-gray-300">Deadline</th>
                      <th className="px-10 py-5 text-[10px] font-black uppercase tracking-widest text-gray-300 text-center">Status Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredOrders.filter(o => o.status !== '출고 완료').map((order, index) => (
                      <tr key={`${order.id}-${index}`} className="hover:bg-brand-50/20 transition-all group">
                        <td className="px-10 py-8">
                           <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest inline-block ${
                              order.status === '대기' ? 'bg-gray-100 text-gray-400' : 'bg-brand-600 text-white shadow-lg shadow-brand-200'
                           }`}>
                            {order.status}
                           </div>
                           <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase">{parseOrderDate(order.orderDate).toLocaleDateString()} IN</p>
                        </td>
                        <td className="px-10 py-8">
                           <h5 className="font-black text-gray-900 group-hover:text-brand-600 transition-colors">{order.orderName}</h5>
                           <p className="text-xs font-bold text-gray-400 mt-1">{order.companyInfo.publisherName} · {order.quantity.toLocaleString()}부</p>
                        </td>
                        <td className="px-10 py-8 text-xs font-bold text-gray-500 leading-relaxed uppercase opacity-80">
                           {order.size} / {order.binding} / {order.innerSections.reduce((sum, s) => sum + s.pages, 0)}P
                        </td>
                        <td className="px-10 py-8">
                           <div className="flex items-center gap-3">
                              <Calendar className="w-4 h-4 text-gray-300" />
                              <span className={`text-sm font-black italic ${
                                 order.delivery.desiredDate && new Date(order.delivery.desiredDate) < new Date() ? 'text-red-600' : 'text-gray-900'
                              }`}>
                                {order.delivery.desiredDate || 'UNDATED'}
                              </span>
                           </div>
                        </td>
                        <td className="px-10 py-8">
                           <div className="flex flex-col gap-4">
                              <div className="flex items-center justify-center gap-1.5">
                                 {['대기', '공정 중', '제본 완료', '출고 완료'].map(s => {
                                    const actualStatus = s === '공정 중' ? '본문 정합 완료' : s;
                                    const isCurrent = order.status === actualStatus;
                                    return (
                                      <button
                                        key={s}
                                        onClick={() => updateOrderStatus(order.id, actualStatus)}
                                        className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                          isCurrent ? 'bg-brand-600 text-white shadow-xl shadow-brand-200' : 'bg-gray-100 text-gray-400 hover:scale-105 active:scale-95'
                                        }`}
                                      >
                                        {s}
                                      </button>
                                    );
                                 })}
                              </div>
                              <div className="flex items-center justify-center gap-2">
                                 <button onClick={() => editOrder(order)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-[10px] font-black text-gray-400 hover:text-brand-600 hover:border-brand-200 transition-all uppercase tracking-widest">
                                    <Edit2 className="w-3.5 h-3.5" />
                                    Adjust Specs
                                 </button>
                              </div>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <React.Fragment>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Form Area */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Welcome Banner / Company Identification */}
            {(() => {
              const inputCode = (form.companyInfo.code || '').trim().toLowerCase();
              const company = priceConfig.separateCompanies.find(c => 
                (c.code || '').trim().toLowerCase() === inputCode
              );
              
              if (company) {
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-brand-50 border border-brand-100 rounded-2xl p-6 flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-200">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-brand-900 text-lg">{company.name}님, 환영합니다!</h3>
                      <p className="text-brand-600 text-sm">해당 거래처의 별도 단가가 자동으로 적용됩니다.</p>
                    </div>
                  </motion.div>
                );
              }
              return null;
            })()}

            {/* 1. Basic Info */}
            <section className="glass-card rounded-[2.5rem] p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-50 rounded-2xl flex items-center justify-center">
                    <Info className="w-5 h-5 text-brand-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">기본 정보</h2>
                </div>
                <button 
                  onClick={() => setUserView('orders')}
                  className="text-xs font-bold text-brand-600 hover:bg-brand-50 flex items-center gap-2 px-4 py-2 rounded-xl transition-all border border-brand-100"
                >
                  <History className="w-3.5 h-3.5" />
                  이전 견적 불러오기
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-1">주문명 (도서 제목)</label>
                  <input 
                    type="text" 
                    placeholder="도서 제목을 입력하세요"
                    className="w-full px-5 py-3 rounded-2xl border-2 border-gray-50 focus:border-brand-500 bg-gray-50/30 outline-none transition-all placeholder:text-gray-300"
                    value={form.orderName}
                    onChange={e => setForm({...form, orderName: e.target.value})}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-1">규격 (판형)</label>
                  <div className="space-y-3">
                    <div className="relative">
                      <select 
                        className="w-full px-5 py-3 rounded-2xl border-2 border-gray-50 focus:border-brand-500 bg-gray-50/30 outline-none transition-all appearance-none cursor-pointer"
                        value={form.size}
                        onChange={e => {
                          const newSize = e.target.value;
                          let customSize = form.customSize;
                          if (newSize === '46판') customSize = { width: 128, height: 188 };
                          else if (newSize === '신국판') customSize = { width: 152, height: 225 };
                          else if (newSize === '46배판') customSize = { width: 188, height: 257 };
                          else if (newSize === '국배판') customSize = { width: 210, height: 297 };
                          setForm({...form, size: newSize, customSize});
                        }}
                      >
                        {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none w-4 h-4" />
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input 
                          type="number" 
                          placeholder="가로"
                          className="w-full px-5 py-3 rounded-2xl border-2 border-gray-50 outline-none focus:border-brand-500 bg-gray-50/30"
                          value={form.customSize?.width || ''}
                          onChange={e => setForm({...form, customSize: {...(form.customSize || {height: 0}), width: parseInt(e.target.value) || 0}})}
                        />
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] text-gray-300 font-black tracking-widest uppercase">W</span>
                      </div>
                      <span className="text-gray-200 font-bold">×</span>
                      <div className="relative flex-1">
                        <input 
                          type="number" 
                          placeholder="세로"
                          className="w-full px-5 py-3 rounded-2xl border-2 border-gray-50 outline-none focus:border-brand-500 bg-gray-50/30"
                          value={form.customSize?.height || ''}
                          onChange={e => setForm({...form, customSize: {...(form.customSize || {width: 0}), height: parseInt(e.target.value) || 0}})}
                        />
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] text-gray-300 font-black tracking-widest uppercase">H</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-1">제작 부수</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      className="w-full px-5 py-3 rounded-2xl border-2 border-gray-50 focus:border-brand-500 bg-gray-50/30 outline-none transition-all font-bold text-brand-600"
                      value={form.quantity}
                      onChange={e => setForm({...form, quantity: parseInt(e.target.value) || 0})}
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">부</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-1">제본 유형</label>
                  <div className="relative">
                    <select 
                      className="w-full px-5 py-3 rounded-2xl border-2 border-gray-50 focus:border-brand-500 bg-gray-50/30 outline-none transition-all appearance-none cursor-pointer"
                      value={form.binding}
                      onChange={e => setForm({...form, binding: e.target.value})}
                    >
                      {BINDING_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none w-4 h-4" />
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Cover Info */}
            <section className="glass-card rounded-[2.5rem] p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-50 rounded-2xl flex items-center justify-center">
                    <Layers className="w-5 h-5 text-brand-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">표지 사양</h2>
                </div>
                <div className="flex items-center gap-2">
                  {!form.bellyBand?.enabled && (
                    <button 
                      onClick={() => setForm({...form, bellyBand: {...form.bellyBand, enabled: true}})}
                      className="flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-600 rounded-xl text-xs font-bold hover:bg-brand-100 transition-all border border-brand-100"
                    >
                      <Plus className="w-3.5 h-3.5" /> 띠지 추가
                    </button>
                  )}
                  {!form.jacket?.enabled && (
                    <button 
                      onClick={() => setForm({...form, jacket: {...form.jacket, enabled: true}})}
                      className="flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-600 rounded-xl text-xs font-bold hover:bg-brand-100 transition-all border border-brand-100"
                    >
                      <Plus className="w-3.5 h-3.5" /> 자켓 추가
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-1">용지명</label>
                  <div className="space-y-3">
                    <div className="relative">
                      <select 
                        className="w-full px-5 py-3 rounded-2xl border-2 border-gray-50 focus:border-brand-500 bg-gray-50/30 outline-none transition-all appearance-none cursor-pointer"
                        value={form.cover.paper || '스노우'}
                        onChange={e => {
                          const paper = e.target.value;
                          const weights = COVER_PAPER_WEIGHTS[paper] || [];
                          setForm({
                            ...form, 
                            cover: {
                              ...form.cover, 
                              paper, 
                              weight: weights.length > 0 ? weights[0] : (paper === '직접 입력' ? '' : '250')
                            }
                          });
                        }}
                      >
                        {COVER_PAPERS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none w-4 h-4" />
                    </div>
                    {form.cover.paper === '직접 입력' && (
                      <input 
                        type="text" 
                        placeholder="용지명 직접 입력"
                        className="w-full px-5 py-3 rounded-2xl border-2 border-gray-50 outline-none focus:border-brand-500 bg-gray-50/30"
                        value={form.cover.customPaper || ''}
                        onChange={e => setForm({...form, cover: {...form.cover, customPaper: e.target.value}})}
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-1">평량</label>
                  <div className="space-y-3">
                    {form.cover.paper === '직접 입력' ? (
                      <div className="relative">
                        <input 
                          type="number" 
                          placeholder="평량 입력"
                          className="w-full px-5 py-3 rounded-2xl border-2 border-gray-50 outline-none focus:border-brand-500 bg-gray-50/30"
                          value={form.cover.weight}
                          onChange={e => setForm({...form, cover: {...form.cover, weight: e.target.value}})}
                        />
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">g</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {(COVER_PAPER_WEIGHTS[form.cover.paper] || []).map(w => (
                          <button
                            key={w}
                            onClick={() => setForm({...form, cover: {...form.cover, weight: w}})}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                              form.cover.weight === w
                              ? 'bg-brand-600 text-white shadow-lg shadow-brand-100'
                              : 'bg-gray-100 border border-transparent text-gray-400 hover:bg-gray-200'
                            }`}
                          >
                            {w}g
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">인쇄도수</label>
                  <select 
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white"
                    value={form.cover.printing}
                    onChange={e => setForm({...form, cover: {...form.cover, printing: e.target.value}})}
                  >
                    <option value="단면 4도">단면 4도</option>
                    <option value="양면 4도">양면 4도 (+50원)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">코팅</label>
                  <select 
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white"
                    value={form.cover.coating}
                    onChange={e => setForm({...form, cover: {...form.cover, coating: e.target.value}})}
                  >
                    {COATING_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Belly Band Section */}
              {form.bellyBand?.enabled && (
                <div className="mt-8 pt-8 border-t border-gray-100 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                      <Layers className="w-4 h-4" /> 띠지 사양
                    </h3>
                    <button 
                      onClick={() => setForm({...form, bellyBand: {...form.bellyBand, enabled: false}})}
                      className="text-xs font-bold text-red-500 hover:text-red-600"
                    >
                      제거
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">용지명</label>
                      <div className="space-y-2">
                        <select 
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
                          value={form.bellyBand.paper}
                          onChange={e => {
                            const paper = e.target.value;
                            const weights = COVER_PAPER_WEIGHTS[paper] || [];
                            setForm({
                              ...form, 
                              bellyBand: {
                                ...form.bellyBand, 
                                paper, 
                                weight: weights.length > 0 ? weights[0] : (paper === '직접 입력' ? '' : '150')
                              }
                            });
                          }}
                        >
                          {COVER_PAPERS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        {form.bellyBand.paper === '직접 입력' && (
                          <input 
                            type="text" 
                            placeholder="용지명 직접 입력"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={form.bellyBand.customPaper || ''}
                            onChange={e => setForm({...form, bellyBand: {...form.bellyBand, customPaper: e.target.value}})}
                          />
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">평량</label>
                      <div className="space-y-2">
                        {form.bellyBand.paper === '직접 입력' ? (
                          <div className="relative">
                            <input 
                              type="number" 
                              placeholder="평량 입력"
                              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                              value={form.bellyBand.weight}
                              onChange={e => setForm({...form, bellyBand: {...form.bellyBand, weight: e.target.value}})}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">g</span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {(COVER_PAPER_WEIGHTS[form.bellyBand.paper] || []).map(w => (
                              <button
                                key={w}
                                onClick={() => setForm({...form, bellyBand: {...form.bellyBand, weight: w}})}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  form.bellyBand?.weight === w
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                }`}
                              >
                                {w}g
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">인쇄도수</label>
                      <select 
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
                        value={form.bellyBand.printing}
                        onChange={e => setForm({...form, bellyBand: {...form.bellyBand, printing: e.target.value}})}
                      >
                        <option value="단면 4도">단면 4도</option>
                        <option value="양면 4도">양면 4도 (+50원)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">코팅</label>
                      <select 
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
                        value={form.bellyBand.coating}
                        onChange={e => setForm({...form, bellyBand: {...form.bellyBand, coating: e.target.value}})}
                      >
                        {COATING_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Jacket Section */}
              {form.jacket?.enabled && (
                <div className="mt-8 pt-8 border-t border-gray-100 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                      <Layers className="w-4 h-4" /> 자켓 사양
                    </h3>
                    <button 
                      onClick={() => setForm({...form, jacket: {...form.jacket, enabled: false}})}
                      className="text-xs font-bold text-red-500 hover:text-red-600"
                    >
                      제거
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">용지명</label>
                      <div className="space-y-2">
                        <select 
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
                          value={form.jacket.paper}
                          onChange={e => {
                            const paper = e.target.value;
                            const weights = COVER_PAPER_WEIGHTS[paper] || [];
                            setForm({
                              ...form, 
                              jacket: {
                                ...form.jacket, 
                                paper, 
                                weight: weights.length > 0 ? weights[0] : (paper === '직접 입력' ? '' : '150')
                              }
                            });
                          }}
                        >
                          {COVER_PAPERS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        {form.jacket.paper === '직접 입력' && (
                          <input 
                            type="text" 
                            placeholder="용지명 직접 입력"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={form.jacket.customPaper || ''}
                            onChange={e => setForm({...form, jacket: {...form.jacket, customPaper: e.target.value}})}
                          />
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">평량</label>
                      <div className="space-y-2">
                        {form.jacket.paper === '직접 입력' ? (
                          <div className="relative">
                            <input 
                              type="number" 
                              placeholder="평량 입력"
                              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                              value={form.jacket.weight}
                              onChange={e => setForm({...form, jacket: {...form.jacket, weight: e.target.value}})}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">g</span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {(COVER_PAPER_WEIGHTS[form.jacket.paper] || []).map(w => (
                              <button
                                key={w}
                                onClick={() => setForm({...form, jacket: {...form.jacket, weight: w}})}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  form.jacket?.weight === w
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                }`}
                              >
                                {w}g
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">인쇄도수</label>
                      <select 
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
                        value={form.jacket.printing}
                        onChange={e => setForm({...form, jacket: {...form.jacket, printing: e.target.value}})}
                      >
                        <option value="단면 4도">단면 4도</option>
                        <option value="양면 4도">양면 4도 (+50원)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">코팅</label>
                      <select 
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
                        value={form.jacket.coating}
                        onChange={e => setForm({...form, jacket: {...form.jacket, coating: e.target.value}})}
                      >
                        {COATING_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* 3. Inner Sections */}
            <section className="glass-card rounded-[2.5rem] p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-50 rounded-2xl flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-brand-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">내지 사양</h2>
                </div>
                <button 
                  onClick={addInnerSection}
                  className="flex items-center gap-2 text-sm font-bold text-brand-600 hover:bg-brand-50 px-4 py-2 rounded-xl transition-all border border-brand-100"
                >
                  <Plus className="w-4 h-4" /> 내지 추가
                </button>
              </div>
              
              <div className="space-y-6">
                <AnimatePresence mode="popLayout">
                  {form.innerSections.map((section, index) => (
                    <motion.div 
                      key={section.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-6 rounded-[2rem] border-2 border-gray-50 bg-gray-50/20 relative group hover:border-brand-100 transition-all"
                    >
                      {form.innerSections.length > 1 && (
                        <button 
                          onClick={() => removeInnerSection(section.id)}
                          className="absolute -top-3 -right-3 bg-white text-red-500 p-2 rounded-xl shadow-xl border border-gray-100 opacity-0 group-hover:opacity-100 transition-all active:scale-95"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <div className="text-[10px] font-black text-gray-300 uppercase mb-4 tracking-[0.2em]">SECTION {index + 1}</div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray-400 tracking-wider">용지</label>
                          <select 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-100 text-sm bg-white outline-none focus:border-brand-500"
                            value={section.paper}
                            onChange={e => updateInnerSection(section.id, { paper: e.target.value })}
                          >
                            {INNER_PAPERS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray-400 tracking-wider">평량</label>
                          <select 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-100 text-sm bg-white outline-none focus:border-brand-500"
                            value={section.weight}
                            onChange={e => updateInnerSection(section.id, { weight: e.target.value })}
                          >
                            <option value="80g">80g</option>
                            <option value="100g">100g</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray-400 tracking-wider">도수</label>
                          <select 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-100 text-sm bg-white outline-none focus:border-brand-500"
                            value={section.printing}
                            onChange={e => updateInnerSection(section.id, { printing: e.target.value })}
                          >
                            <option value="1도">1도</option>
                            <option value="2도">2도</option>
                            <option value="4도">4도</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray-400 tracking-wider">페이지</label>
                          <div className="relative">
                            <input 
                              type="number" 
                              className="w-full px-4 py-2.5 rounded-xl border border-gray-100 text-sm outline-none focus:border-brand-500 font-bold"
                              value={section.pages}
                              onChange={e => updateInnerSection(section.id, { pages: parseInt(e.target.value) || 0 })}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300">P</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>

            {/* 4. Post Processing */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-6">
                <Settings className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-semibold">후가공 옵션</h2>
              </div>
              
              <div className="space-y-6">
                {/* Checkbox Style Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setForm({...form, cover: {...form.cover, hasFlaps: !form.cover.hasFlaps}})}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      form.cover.hasFlaps ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📖</span>
                      <span className="font-medium">표지 날개</span>
                    </div>
                    {form.cover.hasFlaps && <CheckCircle2 className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => setForm({...form, postProcessing: {...form.postProcessing, epoxy: !form.postProcessing.epoxy}})}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      form.postProcessing.epoxy ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">✨</span>
                      <span className="font-medium">에폭시</span>
                    </div>
                    {form.postProcessing.epoxy && <CheckCircle2 className="w-5 h-5" />}
                  </button>
                </div>

                {/* Select Style Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      🎨 면지 옵션
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {ENDPAPER_TYPES.map(type => (
                        <button
                          key={type}
                          onClick={() => setForm({...form, postProcessing: {...form.postProcessing, endpaper: type}})}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                            form.postProcessing.endpaper === type
                            ? 'bg-brand-600 border-brand-600 text-white shadow-md'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    {form.postProcessing.endpaper !== '없음' && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">면지 인쇄 페이지 수</label>
                          <div className="flex gap-2">
                            {[4, 8].map(p => (
                              <button
                                key={p}
                                onClick={() => setForm({...form, postProcessing: {...form.postProcessing, endpaperPages: p}})}
                                className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-all ${
                                  form.postProcessing.endpaperPages === p
                                  ? 'bg-brand-600 border-brand-600 text-white'
                                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                              >
                                {p}p
                              </button>
                            ))}
                            <div className="relative flex-[1.5]">
                              <input 
                                type="number"
                                placeholder="직접 입력"
                                className="w-full pl-3 pr-8 py-2 rounded-lg border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                value={form.postProcessing.endpaperPages || ''}
                                onChange={e => setForm({...form, postProcessing: {...form.postProcessing, endpaperPages: parseInt(e.target.value) || 0}})}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">p</span>
                            </div>
                          </div>
                        </div>

                        {form.postProcessing.endpaper === '제물면지' && (
                          <div className="space-y-2">
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">제물면지 색상</label>
                            <input
                              type="text"
                              value={form.postProcessing.endpaperColor || ''}
                              onChange={(e) => setForm({...form, postProcessing: {...form.postProcessing, endpaperColor: e.target.value}})}
                              placeholder="색상을 입력하세요 (예: 연미색, 진청색 등)"
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      🪙 디지털 박 옵션
                    </label>
                    <select 
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-sm"
                      value={form.postProcessing.foil}
                      onChange={e => setForm({...form, postProcessing: {...form.postProcessing, foil: e.target.value}})}
                    >
                      {FOIL_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {/* 5. Company Info */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-6">
                <User className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-semibold">거래처 정보</h2>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">거래처 선택</label>
                    <select 
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      onChange={(e) => {
                        const company = priceConfig.separateCompanies.find(c => c.id === e.target.value);
                        if (company) {
                          setForm(prev => ({
                            ...prev,
                            companyInfo: {
                              ...prev.companyInfo,
                              code: company.code || '',
                              publisherName: company.name
                            }
                          }));
                        }
                      }}
                      value={priceConfig.separateCompanies.find(c => (c.code || '').trim().toLowerCase() === (form.companyInfo.code || '').trim().toLowerCase())?.id || ''}
                    >
                      <option value="">거래처를 선택하세요 (선택 사항)</option>
                      {priceConfig.separateCompanies.map(company => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">거래처 코드</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="코드를 입력하면 자동 인식됩니다"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        value={form.companyInfo.code}
                        onChange={e => setForm(prev => ({
                          ...prev,
                          companyInfo: { ...prev.companyInfo, code: e.target.value }
                        }))}
                      />
                      {(() => {
                        const inputCode = (form.companyInfo.code || '').trim().toLowerCase();
                        const isMatch = priceConfig.separateCompanies.some(c => 
                          (c.code || '').trim().toLowerCase() === inputCode && inputCode !== ''
                        );
                        return isMatch && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-lg">
                            <CheckCircle2 className="w-3 h-3" />
                            인증됨
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">출판사명 / 주문자명</label>
                  <input 
                    type="text" 
                    placeholder="출판사명 또는 주문자명을 입력하세요"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={form.companyInfo.publisherName}
                    onChange={e => setForm(prev => ({
                      ...prev,
                      companyInfo: { ...prev.companyInfo, publisherName: e.target.value }
                    }))}
                  />
                </div>
              </div>
            </section>

            {/* 6. Delivery Info */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-semibold">배송 및 추가 정보</h2>
                </div>
                <button 
                  onClick={() => setShowAddressList(true)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <MapPin className="w-3 h-3" />
                  배송지 목록
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">출판사명 (확인)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.companyInfo.publisherName}
                    onChange={e => setForm({...form, companyInfo: {...form.companyInfo, publisherName: e.target.value}})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">담당자 성함</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.companyInfo.contactName}
                    onChange={e => setForm({...form, companyInfo: {...form.companyInfo, contactName: e.target.value}})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">연락처</label>
                  <input 
                    type="tel" 
                    placeholder="010-0000-0000"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.companyInfo.contactPhone}
                    onChange={e => setForm({...form, companyInfo: {...form.companyInfo, contactPhone: e.target.value}})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">출고 희망일</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.delivery.desiredDate}
                    onChange={e => setForm({...form, delivery: {...form.delivery, desiredDate: e.target.value}})}
                  />
                </div>

                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <Truck className="w-4 h-4" />
                      배송지 정보 ({form.delivery.locations.length})
                    </h3>
                    <button
                      onClick={addDeliveryLocation}
                      className="flex items-center gap-1 px-3 py-1.5 bg-brand-50 text-brand-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      배송지 추가
                    </button>
                  </div>

                  <div className="space-y-4">
                    {form.delivery.locations.map((loc, index) => (
                      <div key={loc.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4 relative">
                        {form.delivery.locations.length > 1 && (
                          <button
                            onClick={() => removeDeliveryLocation(loc.id)}
                            className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">배송 방법</label>
                            <select
                              value={loc.method}
                              onChange={e => updateDeliveryLocation(index, { method: e.target.value })}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              {['퀵', '직배', '방문수령', '택배'].map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">수량 (부수)</label>
                            <input
                              type="number"
                              value={loc.quantity || ''}
                              onChange={e => updateDeliveryLocation(index, { quantity: parseInt(e.target.value) || 0 })}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">수령인</label>
                            <input
                              type="text"
                              value={loc.contactName}
                              onChange={e => updateDeliveryLocation(index, { contactName: e.target.value })}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">연락처</label>
                            <input
                              type="tel"
                              value={loc.contactPhone}
                              onChange={e => updateDeliveryLocation(index, { contactPhone: e.target.value })}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">배송 주소</label>
                            <div className="flex gap-3">
                              <button 
                                onClick={() => {
                                  setActiveLocationIndex(index);
                                  setShowAddressList(true);
                                }}
                                className="text-[10px] font-bold text-indigo-600 hover:underline"
                              >
                                저장된 배송지 불러오기
                              </button>
                              <button 
                                onClick={() => saveAddress(index)}
                                className="text-[10px] font-bold text-gray-400 hover:text-indigo-600 transition-colors"
                              >
                                이 주소를 배송지 리스트에 저장
                              </button>
                            </div>
                          </div>
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 bg-white rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-brand-500"
                            placeholder="상세 주소를 입력하세요"
                            value={loc.address}
                            onChange={e => updateDeliveryLocation(index, { address: e.target.value })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {form.quantity !== form.delivery.locations.reduce((sum, l) => sum + l.quantity, 0) && (
                    <p className="text-[11px] font-bold text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
                      ⚠️ 주의: 배송지별 수량 합계({form.delivery.locations.reduce((sum, l) => sum + l.quantity, 0)}부)가 총 주문 수량({form.quantity}부)과 일치하지 않습니다.
                    </p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">요청 사항</label>
                  <textarea 
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    placeholder="특별히 요청하실 내용을 입력하세요"
                    value={form.delivery.requests}
                    onChange={e => setForm({...form, delivery: {...form.delivery, requests: e.target.value}})}
                  />
                </div>
              </div>
            </section>
        </div>

        {/* Sidebar Summary */}
        <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              <div className="glass-card rounded-[2.5rem] overflow-hidden">
                <div className="bg-brand-600 px-8 py-6 text-white text-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-1">
                      <Calculator className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold">견적 결과 요약</h3>
                    <p className="text-[10px] text-brand-100 font-bold uppercase tracking-widest opacity-80">Real-time Calculation</p>
                  </div>
                </div>
                <div className="p-8 space-y-6">
                  <div className="space-y-3 pb-6 border-b border-dashed border-gray-100">
                    <div className="flex justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-50">
                      <span className="text-[11px] font-black text-gray-300 uppercase tracking-widest">주문명</span>
                      <span className="font-bold text-sm truncate max-w-[140px] text-gray-700">{form.orderName || '미입력'}</span>
                    </div>
                    <div className="flex justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-50">
                      <span className="text-[11px] font-black text-gray-300 uppercase tracking-widest">규격 / 부수</span>
                      <span className="font-bold text-sm text-gray-700">{form.size} / {form.quantity}부</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-bold">표지 인쇄비</span>
                      <div className="text-right">
                        <div className="text-gray-900 font-black">{priceBreakdown.cover.final.toLocaleString()}원</div>
                        {priceBreakdown.cover.discount > 0 && (
                          <div className="text-[10px] text-emerald-600 font-black tracking-tighter uppercase">5% OFF</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-bold">내지 인쇄비</span>
                      <div className="text-right">
                        <div className="text-gray-900 font-black">{priceBreakdown.inner.final.toLocaleString()}원</div>
                        {priceBreakdown.inner.discount > 0 && (
                          <div className="text-[10px] text-emerald-600 font-black tracking-tighter uppercase">5% OFF</div>
                        )}
                      </div>
                    </div>
                    {form.postProcessing.endpaper !== '없음' && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 font-bold">면지 비용</span>
                        <div className="text-right">
                          <div className="text-gray-900 font-black">{priceBreakdown.endpaper.final.toLocaleString()}원</div>
                          {priceBreakdown.endpaper.discount > 0 && (
                            <div className="text-[10px] text-emerald-600 font-black tracking-tighter uppercase">50% OFF</div>
                          )}
                        </div>
                      </div>
                    )}
                    {form.bellyBand?.enabled && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 font-bold">띠지 비용</span>
                        <div className="text-right">
                          <div className="text-gray-900 font-black">{(priceBreakdown.extras.find(e => e.name === '띠지')?.cost || 0).toLocaleString()}원</div>
                        </div>
                      </div>
                    )}
                    {form.jacket?.enabled && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 font-bold">자켓 비용</span>
                        <div className="text-right">
                          <div className="text-gray-900 font-black">{(priceBreakdown.extras.find(e => e.name === '자켓')?.cost || 0).toLocaleString()}원</div>
                        </div>
                      </div>
                    )}
                    
                    {priceBreakdown.extras.filter(e => e.name !== '띠지' && e.name !== '자켓').length > 0 && (
                      <div className="pt-4 space-y-2 border-t border-gray-50">
                        <div className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-1">OPTIONAL CHARGES</div>
                        {priceBreakdown.extras.filter(e => e.name !== '띠지' && e.name !== '자켓').map((extra, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-gray-50/30 p-2 rounded-lg">
                            <span className="text-[11px] font-bold text-gray-400">{extra.name}</span>
                            <span className="text-xs font-bold text-gray-700">{extra.cost.toLocaleString()}원</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-6 mt-6 border-t border-gray-100 flex flex-col gap-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-10 h-6 rounded-full relative transition-all duration-300 ${form.applyDiscount ? 'bg-emerald-500 shadow-md shadow-emerald-100' : 'bg-gray-200'}`}>
                        <input 
                          type="checkbox" 
                          className="sr-only"
                          checked={form.applyDiscount}
                          onChange={e => setForm({...form, applyDiscount: e.target.checked})}
                        />
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${form.applyDiscount ? 'left-5' : 'left-1'}`} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-700">특별 할인 적용</span>
                        <span className="text-[10px] text-emerald-600 font-bold">전체 금액의 5% 선할인</span>
                      </div>
                    </label>

                    <div className="bg-gray-950 rounded-[2rem] p-8 text-white text-center shadow-2xl shadow-brand-100/20">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Total Amount</span>
                      <div className="text-4xl font-black mt-2">
                        {Math.floor(totalPrice * (form.applyDiscount ? 0.95 : 1)).toLocaleString()}
                        <span className="text-sm font-bold ml-1 text-gray-400">원</span>
                      </div>
                      <div className="text-[10px] text-gray-500 font-bold mt-2 uppercase tracking-widest opacity-50">(VAT 별도)</div>
                    </div>

                  <div className="flex flex-col gap-4 mt-6">
                    <button 
                      onClick={() => handleOrder(totalPrice)}
                      disabled={!form.orderName || !form.companyInfo.publisherName}
                      className="w-full py-5 bg-brand-600 text-white rounded-[1.75rem] font-bold flex items-center justify-center gap-2 hover:bg-brand-700 transition-all shadow-xl shadow-brand-200 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed group"
                    >
                      <Save className="w-5 h-5 transition-transform group-hover:scale-110" />
                      <span className="text-lg">{editingOrderId ? '견적 수정 저장' : '견적 저장 하기'}</span>
                    </button>
                    
                    {editingOrderId ? (
                      <button 
                        onClick={() => {
                          setEditingOrderId(null);
                          setForm(INITIAL_STATE);
                        }}
                        className="w-full py-4 bg-white border-2 border-gray-100 text-gray-400 rounded-[1.5rem] font-bold text-xs hover:border-brand-200 hover:text-brand-600 transition-all"
                      >
                        수정 취소 (신규 작성으로 전환)
                      </button>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                         <button 
                          onClick={() => {
                            if(confirm('모든 입력 내용을 초기화하시겠습니까?')) {
                              setForm(INITIAL_STATE);
                            }
                          }}
                          className="py-3 bg-white border-2 border-gray-100 text-gray-400 rounded-2xl font-bold text-[10px] hover:border-gray-200 uppercase tracking-widest transition-all"
                        >
                          초기화
                        </button>
                        <button 
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.csv,.tsv,.txt';
                            input.onchange = (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (re) => importOrdersFromText(re.target?.result);
                                reader.readAsText(file);
                              }
                            };
                            input.click();
                          }}
                          className="py-3 bg-white border-2 border-brand-100 text-brand-600 rounded-2xl font-bold text-[10px] hover:bg-brand-50 uppercase tracking-widest transition-all"
                        >
                          CSV 가져오기
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-[2rem] p-6 border-brand-100 bg-brand-50/30">
                <h4 className="font-bold text-brand-900 text-sm mb-2 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-brand-600" />
                  실시간 견적 알림
                </h4>
                <p className="text-[11px] text-brand-700 leading-relaxed font-bold opacity-70">
                  입력된 사양에 따라 즉시 최저가가 계산됩니다. 대량 주문(2,000부 이상) 또는 별도 사양은 관리자에게 문의 바랍니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

                  <AnimatePresence>
                    {showSaveSuccess && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50"
                      >
                        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm font-bold">견적 내용이 브라우저에 저장되었습니다.</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

        {/* Paste Modal */}
        <AnimatePresence>
          {isPasteModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsPasteModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">텍스트로 주문 가져오기</h3>
                    <p className="text-xs text-gray-500 mt-1">외부 사이트의 주문 목록을 복사하여 아래에 붙여넣어 주세요.</p>
                  </div>
                  <button 
                    onClick={() => setIsPasteModalOpen(false)}
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="bg-brand-50 p-4 rounded-2xl border border-brand-100 text-[11px] text-brand-700">
                    <p className="font-bold mb-1">💡 도움말</p>
                    <p>주문일, 출고희망일, 출판사, 도서명, 부수, 페이지, 규격 등의 순서로 된 CSV 형식의 텍스트를 지원합니다.</p>
                  </div>
                  <textarea 
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="여기에 주문 목록을 붙여넣으세요..."
                    className="w-full h-80 p-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                  />
                </div>
                <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                  <button 
                    onClick={() => setIsPasteModalOpen(false)}
                    className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all"
                  >
                    취소
                  </button>
                  <button 
                    onClick={() => importOrdersFromText(pasteText)}
                    disabled={!pasteText.trim()}
                    className="px-8 py-2.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    가져오기 실행
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Address List Modal */}
                  <AnimatePresence>
                    {showAddressList && (
                      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
                        >
                          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                              <MapPin className="w-5 h-5 text-brand-600" />
                              저장된 배송지 목록
                            </h3>
                            <button 
                              onClick={() => setShowAddressList(false)}
                              className="p-2 hover:bg-white rounded-xl transition-colors"
                            >
                              <X className="w-5 h-5 text-gray-400" />
                            </button>
                          </div>
                          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                            {savedAddresses.length === 0 ? (
                              <div className="text-center py-12 text-gray-400">
                                <MapPin className="w-12 h-12 mx-auto mb-2 opacity-10" />
                                <p className="text-sm">저장된 배송지가 없습니다.</p>
                              </div>
                            ) : (
                              savedAddresses.map(addr => (
                                <div 
                                  key={addr.id}
                                  className="p-4 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group cursor-pointer"
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 space-y-1" onClick={() => selectAddress(addr, activeLocationIndex)}>
                                      <div className="font-bold text-indigo-900">{addr.label}</div>
                                      <div className="text-sm text-gray-600">{addr.address}</div>
                                      <div className="text-xs text-gray-400">
                                        {addr.contactName} / {addr.contactPhone}
                                      </div>
                                    </div>
                                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          startEditAddress(addr, activeLocationIndex);
                                        }}
                                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                                        title="수정"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteAddress(addr.id);
                                        }}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"
                                        title="삭제"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="p-6 bg-gray-50 border-t border-gray-100">
                            <button 
                              onClick={() => setShowAddressList(false)}
                              className="w-full py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-all"
                            >
                              닫기
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

              <div className="bg-brand-50 rounded-2xl p-6 border border-brand-100">
                <h4 className="text-brand-900 font-bold text-sm mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" /> 안내사항
                </h4>
                <ul className="text-xs text-brand-700 space-y-2 list-disc pl-4">
                  <li>일반/특별 단가 제대로 적용했는지 확인할 것.</li>
                  <li>출고 희망일 오전/오후 설정 확인.</li>
                  <li>출고 희망일 조정 시 변경 반영할 것.</li>
                </ul>
              </div>
            </React.Fragment>
          )}
        </main>
      <footer className="bg-white border-t border-gray-200 mt-20 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2 opacity-50">
              <BookOpen className="w-5 h-5" />
              <span className="font-bold">PrintQuote Pro</span>
            </div>
            <div className="text-sm text-gray-400">
              © 2026 PrintQuote Pro. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm text-gray-500">
              <span>이용약관</span>
              <span className="font-bold">개인정보처리방침</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
