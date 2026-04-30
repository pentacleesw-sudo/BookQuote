export const SIZES = ['46판', '신국판', '46배판', '국배판', '직접 입력'];
export const COVER_PAPERS = ['스노우', '아르떼 울트라화이트', '아르떼 내츄럴화이트', '랑데뷰 울트라화이트', '랑데뷰 내츄럴화이트', '백모조', '앙상블Eclass 백색', '앙상블Eclass EW', '인스퍼M러프 백색', '인스퍼M러프 EW', '아트', '직접 입력'];
export const COVER_PAPER_WEIGHTS = {
  '스노우': ['150', '180', '200', '250', '300'],
  '아르떼 울트라화이트': ['160', '190', '210', '230'],
  '아르떼 내츄럴화이트': ['160', '190', '210', '230'],
  '랑데뷰 울트라화이트': ['160', '190', '210', '240'],
  '랑데뷰 내츄럴화이트': ['160', '190', '210', '240'],
  '백모조': ['150', '180', '200', '220'],
  '앙상블 Eclass 백색': ['210', '230'],
  '앙상블 Eclass EW': ['210', '230'],
  '인스퍼M러프 백색': ['210', '240'],
  '인스퍼M러프 EW': ['210', '240'],
  '아트': ['150', '180', '200', '250', '300'],
};
export const INNER_PAPERS = ['백색 모조지', '미색 모조지', '백색 에스플러스'];
export const BINDING_TYPES = ['세로 좌철', '가로 좌철'];
export const COATING_TYPES = ['유광', '무광', '엠보', '벨벳'];
export const PRINTING_TYPES = ['1도', '2도', '4도'];
export const ENDPAPER_TYPES = ['없음', '제물면지', '베다인쇄'];
export const FOIL_TYPES = ['없음', '유광 금박', '무광 금박', '유광 은박', '무광 은박', '청박', '적박', '먹박', '홀로그램'];

const createDefaultRangeConfig = (baseMultiplier) => ({
  id: 'default',
  innerPrices: {
    '46판': { 
      '1도': { general: 20 * baseMultiplier, special: 18 * baseMultiplier, separate: {} }, 
      '2도': { general: 35 * baseMultiplier, special: 32 * baseMultiplier, separate: {} }, 
      '4도': { general: 60 * baseMultiplier, special: 55 * baseMultiplier, separate: {} } 
    },
    '신국판': { 
      '1도': { general: 25 * baseMultiplier, special: 22 * baseMultiplier, separate: {} }, 
      '2도': { general: 40 * baseMultiplier, special: 36 * baseMultiplier, separate: {} }, 
      '4도': { general: 70 * baseMultiplier, special: 63 * baseMultiplier, separate: {} } 
    },
    '46배판': { 
      '1도': { general: 30 * baseMultiplier, special: 27 * baseMultiplier, separate: {} }, 
      '2도': { general: 50 * baseMultiplier, special: 45 * baseMultiplier, separate: {} }, 
      '4도': { general: 85 * baseMultiplier, special: 76 * baseMultiplier, separate: {} } 
    },
    '국배판': { 
      '1도': { general: 35 * baseMultiplier, special: 31 * baseMultiplier, separate: {} }, 
      '2도': { general: 60 * baseMultiplier, special: 54 * baseMultiplier, separate: {} }, 
      '4도': { general: 100 * baseMultiplier, special: 90 * baseMultiplier, separate: {} } 
    },
    '직접 입력': { 
      '1도': { general: 35 * baseMultiplier, special: 31 * baseMultiplier, separate: {} }, 
      '2도': { general: 60 * baseMultiplier, special: 54 * baseMultiplier, separate: {} }, 
      '4도': { general: 100 * baseMultiplier, special: 90 * baseMultiplier, separate: {} } 
    },
  },
  standardCoverPrice: {
    general: 1100 * baseMultiplier,
    special: 1000 * baseMultiplier,
    separate: {}
  },
  extraCharges: {
    doubleSidedPrinting: { general: 50 * baseMultiplier, special: 45 * baseMultiplier, separate: {} },
    flaps: { general: 200 * baseMultiplier, special: 180 * baseMultiplier, separate: {} },
    coating: { general: 100 * baseMultiplier, special: 90 * baseMultiplier, separate: {} },
    binding: { general: 500 * baseMultiplier, special: 450 * baseMultiplier, separate: {} },
    endpaper: {
      '제물면지': { general: 150 * baseMultiplier, special: 135 * baseMultiplier, separate: {} },
      '베다인쇄': { general: 300 * baseMultiplier, special: 270 * baseMultiplier, separate: {} },
    },
    epoxy: { general: 500 * baseMultiplier, special: 450 * baseMultiplier, separate: {} },
    foil: {
      '유광 금박': { general: 350 * baseMultiplier, special: 315 * baseMultiplier, separate: {} },
      '무광 금박': { general: 350 * baseMultiplier, special: 315 * baseMultiplier, separate: {} },
      '유광 은박': { general: 350 * baseMultiplier, special: 315 * baseMultiplier, separate: {} },
      '무광 은박': { general: 350 * baseMultiplier, special: 315 * baseMultiplier, separate: {} },
      '청박': { general: 400 * baseMultiplier, special: 360 * baseMultiplier, separate: {} },
      '적박': { general: 400 * baseMultiplier, special: 360 * baseMultiplier, separate: {} },
      '먹박': { general: 400 * baseMultiplier, special: 360 * baseMultiplier, separate: {} },
      '홀로그램': { general: 500 * baseMultiplier, special: 450 * baseMultiplier, separate: {} },
    },
  }
});

export const DEFAULT_PRICE_CONFIG = {
  ranges: [
    { id: 'r1', label: '1-50부', min: 1, max: 50, isSpecial: false },
    { id: 'r2', label: '51-100부', min: 51, max: 100, isSpecial: false },
    { id: 'r3', label: '101-200부', min: 101, max: 200, isSpecial: false },
    { id: 'r4', label: '201-300부', min: 201, max: 300, isSpecial: false },
    { id: 'r5', label: '301-400부', min: 301, max: 400, isSpecial: false },
    { id: 'r6', label: '401-500부', min: 401, max: 500, isSpecial: false },
    { id: 'r7', label: '501부 이상', min: 501, max: null, isSpecial: false },
  ],
  pricesByRange: {
    'r1': createDefaultRangeConfig(2.0),
    'r2': createDefaultRangeConfig(1.7),
    'r3': createDefaultRangeConfig(1.4),
    'r4': createDefaultRangeConfig(1.2),
    'r5': createDefaultRangeConfig(1.1),
    'r6': createDefaultRangeConfig(1.0),
    'r7': createDefaultRangeConfig(0.9),
  },
  separateCompanies: []
};
