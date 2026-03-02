export function getSampleCode(
  controlName: string,
  controlType: string,
  eventName: string,
  handlerName: string,
): string {
  const header = `// ${handlerName}(ctx: FormContext, sender: ControlProxy)\n// Control: ${controlName} (${controlType})\n// Event: ${eventName}\n\n`;

  // 컨트롤 타입 + 이벤트 조합별 샘플
  const key = `${controlType}.${eventName}`;
  const samples: Record<string, string> = {
    // Button
    'Button.Click': `${header}// 버튼 클릭 시 실행
const name = ctx.controls.txtName?.text;
if (!name) {
  ctx.controls.lblStatus.text = "이름을 입력해주세요.";
  ctx.controls.lblStatus.foreColor = "#d32f2f";
  return;
}

ctx.controls.lblStatus.text = \`\${name}님, 환영합니다!\`;
ctx.controls.lblStatus.foreColor = "#2e7d32";
`,

    'Button.DoubleClick': `${header}// 버튼 더블클릭 시 실행
ctx.controls.lblStatus.text = "더블클릭 감지됨";
`,

    // TextBox
    'TextBox.TextChanged': `${header}// 텍스트가 변경될 때 실행
const value = sender.text;
ctx.controls.lblStatus.text = \`입력값: \${value} (\${value.length}자)\`;
`,

    'TextBox.KeyPress': `${header}// 키 입력 시 실행 (유효성 검사에 유용)
// 숫자만 허용하는 예시:
// const key = sender.keyChar as string;
// if (!/[0-9]/.test(key)) {
//   sender.handled = true;
// }
`,

    'TextBox.Enter': `${header}// 텍스트박스에 포커스가 들어올 때
sender.backColor = "#FFFDE7";
`,

    'TextBox.Leave': `${header}// 텍스트박스에서 포커스가 나갈 때
sender.backColor = "#FFFFFF";

// 필수 입력 검증 예시
const value = sender.text;
if (!value) {
  ctx.controls.lblStatus.text = "필수 입력 항목입니다.";
  ctx.controls.lblStatus.foreColor = "#d32f2f";
}
`,

    'TextBox.Validating': `${header}// 유효성 검사 (포커스 이동 전)
const text = sender.text;
if (text.length < 2) {
  ctx.controls.lblStatus.text = "2자 이상 입력해주세요.";
  ctx.controls.lblStatus.foreColor = "#d32f2f";
}
`,

    // CheckBox
    'CheckBox.CheckedChanged': `${header}// 체크 상태가 변경될 때
const checked = sender.checked;
ctx.controls.lblStatus.text = checked ? "동의함" : "동의 안 함";

// 다른 컨트롤 활성화/비활성화 예시
// ctx.controls.btnSubmit.enabled = checked;
`,

    'CheckBox.Click': `${header}// 체크박스 클릭 시
const checked = sender.checked;
ctx.controls.lblStatus.text = \`체크 상태: \${checked}\`;
`,

    // ComboBox
    'ComboBox.SelectedIndexChanged': `${header}// 선택 항목이 변경될 때
const index = sender.selectedIndex;
const items = sender.items;
if (index >= 0 && items[index]) {
  ctx.controls.lblStatus.text = \`선택: \${items[index]}\`;
}
`,

    // NumericUpDown
    'NumericUpDown.ValueChanged': `${header}// 값이 변경될 때
const value = sender.value;
ctx.controls.lblStatus.text = \`값: \${value}\`;

// 프로그레스바 연동 예시
// ctx.controls.progressBar1.value = value;
`,

    // DateTimePicker
    'DateTimePicker.ValueChanged': `${header}// 날짜가 변경될 때
const date = sender.value;
ctx.controls.lblStatus.text = \`선택한 날짜: \${date}\`;
`,

    // ListBox
    'ListBox.SelectedIndexChanged': `${header}// 목록 선택이 변경될 때
const index = sender.selectedIndex;
const items = sender.items;
if (index >= 0) {
  ctx.controls.lblStatus.text = \`선택: \${items[index]}\`;
}
`,

    // DataGridView
    'DataGridView.CellClick': `${header}// 셀 클릭 시
// const row = sender.selectedRow as Record<string, unknown>;
// ctx.controls.txtName.text = row?.name ?? "";
`,

    'DataGridView.SelectionChanged': `${header}// 행 선택 변경 시
// const row = sender.selectedRow as Record<string, unknown>;
// if (row) {
//   ctx.controls.lblStatus.text = \`선택된 행: \${JSON.stringify(row)}\`;
// }
`,

    // TabControl
    'TabControl.SelectedIndexChanged': `${header}// 탭 변경 시
const tabIndex = sender.selectedIndex;
ctx.controls.lblStatus.text = \`현재 탭: \${tabIndex}\`;
`,

    // SpreadsheetView
    'SpreadsheetView.CellChanged': `${header}// 셀 값이 변경될 때
// const data = sender.data;
// ctx.controls.lblStatus.text = \`셀 값 변경됨\`;
`,

    'SpreadsheetView.RowAdded': `${header}// 새 행이 추가될 때
// const data = sender.data;
// ctx.controls.lblStatus.text = \`행 추가됨 (총 \${data.length}행)\`;
`,

    'SpreadsheetView.RowDeleted': `${header}// 행이 삭제될 때
// const data = sender.data;
// ctx.controls.lblStatus.text = \`행 삭제됨 (총 \${data.length}행)\`;
`,

    'SpreadsheetView.SelectionChanged': `${header}// 셀 선택이 변경될 때
// ctx.controls.lblStatus.text = "선택 변경됨";
`,

    'SpreadsheetView.DataLoaded': `${header}// 데이터가 로드될 때
// const data = sender.data;
// ctx.controls.lblStatus.text = \`데이터 로드됨 (\${data.length}행)\`;
`,

    // Form events
    'Form.OnLoading': `${header}// 폼이 로드될 때 실행 — 컨트롤 초기화에 적합
// ctx.controls.lblTitle.text = "환영합니다!";
// ctx.controls.comboBox1.items = ["옵션1", "옵션2", "옵션3"];
// ctx.controls.comboBox1.selectedIndex = 0;
`,

    'Form.BeforeLeaving': `${header}// 폼을 떠나기 전 실행 — 저장, 정리에 적합
// const unsaved = ctx.controls.txtContent.text;
// if (unsaved) {
//   ctx.showMessage("저장되지 않은 변경사항이 있습니다.", "경고", "warning");
// }
`,
  };

  if (samples[key]) return samples[key];

  // 이벤트별 일반 샘플
  const genericSamples: Record<string, string> = {
    'Click': `${header}// 클릭 시 실행
ctx.controls.lblStatus.text = "${controlName} 클릭됨";
`,
    'DoubleClick': `${header}// 더블클릭 시 실행
ctx.controls.lblStatus.text = "${controlName} 더블클릭됨";
`,
    'MouseEnter': `${header}// 마우스가 들어올 때
// sender.backColor = "#E3F2FD";
`,
    'MouseLeave': `${header}// 마우스가 나갈 때
// sender.backColor = "#FFFFFF";
`,
    'Validating': `${header}// 유효성 검사
// 검증 실패 시 에러 표시
// ctx.controls.lblStatus.text = "유효하지 않은 값입니다.";
// ctx.controls.lblStatus.foreColor = "#d32f2f";
`,
  };

  if (genericSamples[eventName]) return genericSamples[eventName];

  return `${header}// TODO: 이벤트 핸들러 구현
`;
}
