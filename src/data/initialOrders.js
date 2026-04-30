export const INITIAL_SEED_ORDERS = [
  {
    id: "PB-20260325-001",
    orderDate: "2026-03-25-09:00",
    orderName: "강세윤 실장님이 계속 놀려요",
    size: "46판",
    customSize: { width: 128, height: 188 },
    quantity: 10,
    cover: {
      paper: "아르떼 울트라화이트",
      weight: "210",
      printing: "단면 4도",
      hasFlaps: true,
      coating: "유광"
    },
    bellyBand: { enabled: false, paper: "스노우", weight: "150", printing: "단면 4도", coating: "무광" },
    jacket: { enabled: false, paper: "스노우", weight: "150", printing: "단면 4도", coating: "무광" },
    innerSections: [
      { id: "1", paper: "미색 모조지", weight: "100g", printing: "4도", pages: 204 }
    ],
    binding: "세로 좌철",
    postProcessing: {
      endpaper: "베다인쇄",
      endpaperPages: 4,
      epoxy: false,
      foil: "없음"
    },
    companyInfo: {
      code: "",
      publisherName: "부크크",
      contactName: "",
      contactPhone: ""
    },
    delivery: {
      desiredDate: "03-31 3.31(화) 택배",
      locations: [
        { id: "1", quantity: 10, address: "부크크 물류센터", contactName: "관리자", contactPhone: "010-0000-0000", method: "택배" }
      ],
      requests: ""
    },
    applyDiscount: false,
    totalPrice: 73300,
    status: "결제완료"
  },
  {
    id: "PB-20260325-002",
    orderDate: "2026-03-25-09:10",
    orderName: "김주형 팀장님이 자꾸 놀려요",
    size: "46배판",
    customSize: { width: 182, height: 257 },
    quantity: 100,
    cover: {
      paper: "스노우",
      weight: "250",
      printing: "단면 4도",
      hasFlaps: false,
      coating: "무광"
    },
    bellyBand: { enabled: false, paper: "스노우", weight: "150", printing: "단면 4도", coating: "무광" },
    jacket: { enabled: false, paper: "스노우", weight: "150", printing: "단면 4도", coating: "무광" },
    innerSections: [
      { id: "1", paper: "미색 모조지", weight: "100g", printing: "1도", pages: 144 }
    ],
    binding: "세로 좌철",
    postProcessing: {
      endpaper: "없음",
      endpaperPages: 4,
      epoxy: false,
      foil: "없음"
    },
    companyInfo: {
      code: "",
      publisherName: "부크크",
      contactName: "",
      contactPhone: ""
    },
    delivery: {
      desiredDate: "03-30 3.30(월) 택배",
      locations: [
        { id: "1", quantity: 100, address: "부크크 물류센터", contactName: "관리자", contactPhone: "010-0000-0000", method: "택배" }
      ],
      requests: ""
    },
    applyDiscount: false,
    totalPrice: 481800,
    status: "결제완료"
  },
  {
    id: "PB-20260325-003",
    orderDate: "2026-03-25-09:20",
    orderName: "오페라타이어",
    size: "직접 입력",
    customSize: { width: 137, height: 210 },
    quantity: 110,
    cover: {
      paper: "아르떼 울트라화이트",
      weight: "210",
      printing: "단면 4도",
      hasFlaps: true,
      coating: "무광"
    },
    bellyBand: { enabled: false, paper: "스노우", weight: "150", printing: "단면 4도", coating: "무광" },
    jacket: { enabled: false, paper: "스노우", weight: "150", printing: "단면 4도", coating: "무광" },
    innerSections: [
      { id: "1", paper: "미색 모조지", weight: "80g", printing: "1도", pages: 424 }
    ],
    binding: "세로 좌철",
    postProcessing: {
      endpaper: "제물면지",
      endpaperPages: 4,
      epoxy: false,
      foil: "없음"
    },
    companyInfo: {
      code: "",
      publisherName: "부크크",
      contactName: "",
      contactPhone: ""
    },
    delivery: {
      desiredDate: "03-30 3.30(월) 택배",
      locations: [
        { id: "1", quantity: 110, address: "부크크 물류센터", contactName: "관리자", contactPhone: "010-0000-0000", method: "택배" }
      ],
      requests: ""
    },
    applyDiscount: false,
    totalPrice: 702180,
    status: "결제완료"
  }
];
