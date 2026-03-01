import type { ControlType } from '@webform/common';

export interface ControlDefault {
  size: { width: number; height: number };
  properties: Record<string, unknown>;
  description: string;
  category: string;
  isContainer: boolean;
}

/**
 * 44개 컨트롤 타입별 기본 크기, 속성, 설명, 카테고리.
 * packages/designer/src/stores/designerStore.ts의 getDefaultSize() / getDefaultProperties() 기반.
 */
export const CONTROL_DEFAULTS: Record<ControlType, ControlDefault> = {
  // ── 기본 컨트롤 (11종) ──
  Button: {
    size: { width: 75, height: 23 },
    properties: { text: 'Button' },
    description: '클릭 버튼',
    category: '기본 컨트롤',
    isContainer: false,
  },
  Label: {
    size: { width: 100, height: 23 },
    properties: { text: 'Label' },
    description: '텍스트 레이블',
    category: '기본 컨트롤',
    isContainer: false,
  },
  TextBox: {
    size: { width: 100, height: 23 },
    properties: { text: '' },
    description: '텍스트 입력 필드',
    category: '기본 컨트롤',
    isContainer: false,
  },
  CheckBox: {
    size: { width: 104, height: 24 },
    properties: { text: 'CheckBox', checked: false },
    description: '체크박스',
    category: '기본 컨트롤',
    isContainer: false,
  },
  RadioButton: {
    size: { width: 104, height: 24 },
    properties: { text: 'RadioButton', checked: false, groupName: 'default' },
    description: '라디오 버튼',
    category: '기본 컨트롤',
    isContainer: false,
  },
  ComboBox: {
    size: { width: 121, height: 23 },
    properties: { items: [], selectedIndex: -1 },
    description: '드롭다운 선택',
    category: '기본 컨트롤',
    isContainer: false,
  },
  ListBox: {
    size: { width: 120, height: 96 },
    properties: { items: [], selectedIndex: -1 },
    description: '목록 선택',
    category: '기본 컨트롤',
    isContainer: false,
  },
  NumericUpDown: {
    size: { width: 120, height: 23 },
    properties: { value: 0, minimum: 0, maximum: 100 },
    description: '숫자 입력',
    category: '기본 컨트롤',
    isContainer: false,
  },
  DateTimePicker: {
    size: { width: 200, height: 23 },
    properties: { format: 'Short' },
    description: '날짜/시간 선택',
    category: '기본 컨트롤',
    isContainer: false,
  },
  ProgressBar: {
    size: { width: 100, height: 23 },
    properties: { value: 0, minimum: 0, maximum: 100 },
    description: '진행 표시줄',
    category: '기본 컨트롤',
    isContainer: false,
  },
  PictureBox: {
    size: { width: 100, height: 50 },
    properties: { sizeMode: 'Normal' },
    description: '이미지 표시',
    category: '기본 컨트롤',
    isContainer: false,
  },

  // ── 컨테이너 (4종) ──
  Panel: {
    size: { width: 200, height: 100 },
    properties: { borderStyle: 'None' },
    description: '패널 컨테이너',
    category: '컨테이너',
    isContainer: true,
  },
  GroupBox: {
    size: { width: 200, height: 100 },
    properties: { text: 'GroupBox' },
    description: '그룹 박스 컨테이너',
    category: '컨테이너',
    isContainer: true,
  },
  TabControl: {
    size: { width: 200, height: 100 },
    properties: {
      tabs: [
        { title: 'TabPage1', id: 'tab-1' },
        { title: 'TabPage2', id: 'tab-2' },
      ],
      selectedIndex: 0,
    },
    description: '탭 컨테이너',
    category: '컨테이너',
    isContainer: true,
  },
  SplitContainer: {
    size: { width: 150, height: 100 },
    properties: {},
    description: '분할 패널',
    category: '컨테이너',
    isContainer: true,
  },

  // ── 데이터 컨트롤 (5종) ──
  DataGridView: {
    size: { width: 240, height: 150 },
    properties: { columns: [] },
    description: '데이터 그리드',
    category: '데이터',
    isContainer: false,
  },
  BindingNavigator: {
    size: { width: 100, height: 23 },
    properties: {},
    description: '데이터 네비게이터',
    category: '데이터',
    isContainer: false,
  },
  Chart: {
    size: { width: 100, height: 23 },
    properties: {},
    description: '차트',
    category: '데이터',
    isContainer: false,
  },
  TreeView: {
    size: { width: 100, height: 23 },
    properties: {},
    description: '트리 뷰',
    category: '데이터',
    isContainer: false,
  },
  ListView: {
    size: { width: 100, height: 23 },
    properties: {},
    description: '리스트 뷰',
    category: '데이터',
    isContainer: false,
  },

  // ── 고급 컨트롤 (10종) ──
  MenuStrip: {
    size: { width: 800, height: 24 },
    properties: {
      items: [
        {
          text: '파일',
          children: [
            { text: '새로 만들기', shortcut: 'Ctrl+N' },
            { text: '열기', shortcut: 'Ctrl+O' },
            { text: '저장', shortcut: 'Ctrl+S' },
            { text: '', separator: true },
            { text: '끝내기' },
          ],
        },
        {
          text: '편집',
          children: [
            { text: '실행 취소', shortcut: 'Ctrl+Z' },
            { text: '다시 실행', shortcut: 'Ctrl+Y' },
            { text: '', separator: true },
            { text: '잘라내기', shortcut: 'Ctrl+X' },
            { text: '복사', shortcut: 'Ctrl+C' },
            { text: '붙여넣기', shortcut: 'Ctrl+V' },
          ],
        },
        { text: '보기' },
        { text: '도움말' },
      ],
    },
    description: '메뉴 바 (dock: Top)',
    category: '고급',
    isContainer: false,
  },
  ToolStrip: {
    size: { width: 800, height: 25 },
    properties: {
      items: [
        { type: 'button', text: '새로 만들기', icon: '📄' },
        { type: 'button', text: '열기', icon: '📂' },
        { type: 'button', text: '저장', icon: '💾' },
        { type: 'separator' },
        { type: 'button', text: '잘라내기', icon: '✂' },
        { type: 'button', text: '복사', icon: '📋' },
        { type: 'button', text: '붙여넣기', icon: '📌' },
      ],
    },
    description: '도구 모음 (dock: Top)',
    category: '고급',
    isContainer: false,
  },
  StatusStrip: {
    size: { width: 800, height: 22 },
    properties: {
      items: [{ type: 'label', text: '준비', spring: true }],
    },
    description: '상태 표시줄 (dock: Bottom)',
    category: '고급',
    isContainer: false,
  },
  RichTextBox: {
    size: { width: 300, height: 150 },
    properties: { text: '', readOnly: false, scrollBars: 'Both' },
    description: '서식 있는 텍스트',
    category: '고급',
    isContainer: false,
  },
  WebBrowser: {
    size: { width: 400, height: 300 },
    properties: { url: 'about:blank', allowNavigation: true },
    description: '웹 브라우저',
    category: '고급',
    isContainer: false,
  },
  SpreadsheetView: {
    size: { width: 400, height: 300 },
    properties: {
      columns: [],
      data: [],
      readOnly: false,
      showToolbar: true,
      showFormulaBar: true,
      showRowNumbers: true,
      allowAddRows: true,
      allowDeleteRows: true,
      allowSort: true,
      allowFilter: false,
    },
    description: '스프레드시트',
    category: '고급',
    isContainer: false,
  },
  JsonEditor: {
    size: { width: 300, height: 250 },
    properties: { value: {}, readOnly: false, expandDepth: 1 },
    description: 'JSON 편집기',
    category: '고급',
    isContainer: false,
  },
  MongoDBView: {
    size: { width: 450, height: 350 },
    properties: {
      connectionString: '',
      database: '',
      collection: '',
      filter: '{}',
      pageSize: 50,
      readOnly: false,
      showToolbar: true,
    },
    description: 'MongoDB 뷰어',
    category: '고급',
    isContainer: false,
  },
  GraphView: {
    size: { width: 400, height: 300 },
    properties: { graphType: 'Bar', title: '', showLegend: true, showGrid: true },
    description: '그래프 뷰',
    category: '고급',
    isContainer: false,
  },
  MongoDBConnector: {
    size: { width: 120, height: 40 },
    properties: {
      connectionString: '',
      database: '',
      defaultCollection: '',
      queryTimeout: 10000,
      maxResultCount: 1000,
    },
    description: 'MongoDB 연결',
    category: '고급',
    isContainer: false,
  },

  // ── Extra Elements — Step 1 (6종) ──
  Slider: {
    size: { width: 200, height: 30 },
    properties: { value: 0, minimum: 0, maximum: 100, orientation: 'Horizontal', showValue: true },
    description: '슬라이더',
    category: 'Extra (폼 필수)',
    isContainer: false,
  },
  Switch: {
    size: { width: 120, height: 30 },
    properties: { checked: false, text: '', onText: 'ON', offText: 'OFF' },
    description: '토글 스위치',
    category: 'Extra (폼 필수)',
    isContainer: false,
  },
  Upload: {
    size: { width: 300, height: 120 },
    properties: {
      uploadMode: 'DropZone',
      text: 'Click or drag file to upload',
      borderStyle: 'Dashed',
    },
    description: '파일 업로드',
    category: 'Extra (폼 필수)',
    isContainer: false,
  },
  Alert: {
    size: { width: 300, height: 50 },
    properties: {
      message: 'Alert message',
      description: '',
      alertType: 'Info',
      showIcon: true,
      closable: false,
      banner: false,
    },
    description: '알림',
    category: 'Extra (폼 필수)',
    isContainer: false,
  },
  Tag: {
    size: { width: 200, height: 30 },
    properties: { tags: ['Tag1', 'Tag2'], tagColor: 'Default', closable: false, addable: false },
    description: '태그',
    category: 'Extra (폼 필수)',
    isContainer: false,
  },
  Divider: {
    size: { width: 300, height: 24 },
    properties: { text: '', orientation: 'Horizontal', textAlign: 'Center', lineStyle: 'Solid' },
    description: '구분선',
    category: 'Extra (폼 필수)',
    isContainer: false,
  },

  // ── Extra Elements — Step 2 (6종) ──
  Card: {
    size: { width: 300, height: 200 },
    properties: {
      title: 'Card Title',
      subtitle: '',
      showHeader: true,
      showBorder: true,
      hoverable: false,
      size: 'Default',
      borderRadius: 8,
    },
    description: '카드 컨테이너',
    category: 'Extra (모던 UI)',
    isContainer: true,
  },
  Badge: {
    size: { width: 80, height: 30 },
    properties: {
      count: 0,
      overflowCount: 99,
      showZero: false,
      dot: false,
      status: 'Default',
      text: '',
      badgeColor: '',
    },
    description: '배지',
    category: 'Extra (모던 UI)',
    isContainer: false,
  },
  Avatar: {
    size: { width: 40, height: 40 },
    properties: { imageUrl: '', text: 'U', shape: 'Circle' },
    description: '아바타',
    category: 'Extra (모던 UI)',
    isContainer: false,
  },
  Tooltip: {
    size: { width: 100, height: 30 },
    properties: { title: 'Tooltip text', placement: 'Top', trigger: 'Hover' },
    description: '툴팁',
    category: 'Extra (모던 UI)',
    isContainer: false,
  },
  Collapse: {
    size: { width: 300, height: 200 },
    properties: {
      panels: [
        { title: 'Panel 1', key: '1' },
        { title: 'Panel 2', key: '2' },
      ],
      activeKeys: '1',
      accordion: false,
      bordered: true,
      expandIconPosition: 'Start',
    },
    description: '접기/펼치기 컨테이너',
    category: 'Extra (모던 UI)',
    isContainer: true,
  },
  Statistic: {
    size: { width: 150, height: 80 },
    properties: {
      title: 'Statistic',
      value: '0',
      prefix: '',
      suffix: '',
      precision: 0,
      showGroupSeparator: true,
      valueColor: '',
    },
    description: '통계 표시',
    category: 'Extra (모던 UI)',
    isContainer: false,
  },
};
