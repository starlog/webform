/**
 * 샘플 프로젝트 + 폼 시드 스크립트
 * 사용법: pnpm --filter @webform/server seed
 */
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { env } from './config/index.js';
import { Form } from './models/Form.js';
import { Project } from './models/Project.js';

const SEED_USER = 'seed-admin';

async function seed() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('[seed] MongoDB 연결 완료');

  // --- 1. 프로젝트 생성 ---
  let project = await Project.findOne({ name: 'Sample Project', deletedAt: null });
  if (!project) {
    project = await Project.create({
      name: 'Sample Project',
      description: '샘플 프로젝트 - 회원가입 폼 예제',
      createdBy: SEED_USER,
      updatedBy: SEED_USER,
    });
    console.log('[seed] 프로젝트 생성:', project._id.toString());
  } else {
    console.log('[seed] 프로젝트 이미 존재:', project._id.toString());
  }

  // --- 2. 샘플 폼 생성 (회원가입 폼) ---
  let form = await Form.findOne({ name: '회원가입', projectId: project._id.toString(), deletedAt: null });
  if (!form) {
    form = await Form.create({
      name: '회원가입',
      version: 1,
      projectId: project._id.toString(),
      status: 'published',
      publishedVersion: 1,
      createdBy: SEED_USER,
      updatedBy: SEED_USER,
      properties: {
        title: '회원가입',
        width: 450,
        height: 520,
        backgroundColor: '#F0F0F0',
        font: { family: 'Segoe UI', size: 9, bold: false, italic: false, underline: false, strikethrough: false },
        startPosition: 'CenterScreen',
        formBorderStyle: 'FixedSingle',
        maximizeBox: false,
        minimizeBox: true,
      },
      controls: [
        // --- 제목 라벨 ---
        {
          id: 'lblTitle',
          type: 'Label',
          name: 'lblTitle',
          position: { x: 20, y: 15 },
          size: { width: 400, height: 30 },
          properties: { text: '회원가입', foreColor: '#1a73e8', font: { family: 'Segoe UI', size: 16, bold: true, italic: false, underline: false, strikethrough: false } },
          anchor: { top: true, bottom: false, left: true, right: false },
          dock: 'None',
          tabIndex: 0,
          visible: true,
          enabled: true,
        },
        // --- 이름 ---
        {
          id: 'lblName',
          type: 'Label',
          name: 'lblName',
          position: { x: 20, y: 65 },
          size: { width: 80, height: 23 },
          properties: { text: '이름' },
          anchor: { top: true, bottom: false, left: true, right: false },
          dock: 'None',
          tabIndex: 1,
          visible: true,
          enabled: true,
        },
        {
          id: 'txtName',
          type: 'TextBox',
          name: 'txtName',
          position: { x: 120, y: 62 },
          size: { width: 290, height: 26 },
          properties: { text: '', placeholderText: '홍길동' },
          anchor: { top: true, bottom: false, left: true, right: false },
          dock: 'None',
          tabIndex: 2,
          visible: true,
          enabled: true,
        },
        // --- 이메일 ---
        {
          id: 'lblEmail',
          type: 'Label',
          name: 'lblEmail',
          position: { x: 20, y: 105 },
          size: { width: 80, height: 23 },
          properties: { text: '이메일' },
          anchor: { top: true, bottom: false, left: true, right: false },
          dock: 'None',
          tabIndex: 3,
          visible: true,
          enabled: true,
        },
        {
          id: 'txtEmail',
          type: 'TextBox',
          name: 'txtEmail',
          position: { x: 120, y: 102 },
          size: { width: 290, height: 26 },
          properties: { text: '', placeholderText: 'user@example.com' },
          anchor: { top: true, bottom: false, left: true, right: false },
          dock: 'None',
          tabIndex: 4,
          visible: true,
          enabled: true,
        },
        // --- 비밀번호 ---
        {
          id: 'lblPassword',
          type: 'Label',
          name: 'lblPassword',
          position: { x: 20, y: 145 },
          size: { width: 80, height: 23 },
          properties: { text: '비밀번호' },
          anchor: { top: true, bottom: false, left: true, right: false },
          dock: 'None',
          tabIndex: 5,
          visible: true,
          enabled: true,
        },
        {
          id: 'txtPassword',
          type: 'TextBox',
          name: 'txtPassword',
          position: { x: 120, y: 142 },
          size: { width: 290, height: 26 },
          properties: { text: '', passwordChar: '●' },
          anchor: { top: true, bottom: false, left: true, right: false },
          dock: 'None',
          tabIndex: 6,
          visible: true,
          enabled: true,
        },
        // --- 성별 (ComboBox) ---
        {
          id: 'lblGender',
          type: 'Label',
          name: 'lblGender',
          position: { x: 20, y: 185 },
          size: { width: 80, height: 23 },
          properties: { text: '성별' },
          anchor: { top: true, bottom: false, left: true, right: false },
          dock: 'None',
          tabIndex: 7,
          visible: true,
          enabled: true,
        },
        {
          id: 'cmbGender',
          type: 'ComboBox',
          name: 'cmbGender',
          position: { x: 120, y: 182 },
          size: { width: 150, height: 26 },
          properties: {
            items: ['남성', '여성', '기타'],
            selectedIndex: -1,
            dropDownStyle: 'DropDownList',
          },
          anchor: { top: true, bottom: false, left: true, right: false },
          dock: 'None',
          tabIndex: 8,
          visible: true,
          enabled: true,
        },
        // --- 생년월일 (DateTimePicker) ---
        {
          id: 'lblBirthDate',
          type: 'Label',
          name: 'lblBirthDate',
          position: { x: 20, y: 225 },
          size: { width: 80, height: 23 },
          properties: { text: '생년월일' },
          anchor: { top: true, bottom: false, left: true, right: false },
          dock: 'None',
          tabIndex: 9,
          visible: true,
          enabled: true,
        },
        {
          id: 'dtpBirthDate',
          type: 'DateTimePicker',
          name: 'dtpBirthDate',
          position: { x: 120, y: 222 },
          size: { width: 200, height: 26 },
          properties: { format: 'Short' },
          anchor: { top: true, bottom: false, left: true, right: false },
          dock: 'None',
          tabIndex: 10,
          visible: true,
          enabled: true,
        },
        // --- 약관 동의 (CheckBox) ---
        {
          id: 'chkAgree',
          type: 'CheckBox',
          name: 'chkAgree',
          position: { x: 120, y: 270 },
          size: { width: 290, height: 23 },
          properties: { text: '이용약관에 동의합니다', checked: false },
          anchor: { top: true, bottom: false, left: true, right: false },
          dock: 'None',
          tabIndex: 11,
          visible: true,
          enabled: true,
        },
        {
          id: 'chkMarketing',
          type: 'CheckBox',
          name: 'chkMarketing',
          position: { x: 120, y: 300 },
          size: { width: 290, height: 23 },
          properties: { text: '마케팅 수신에 동의합니다 (선택)', checked: false },
          anchor: { top: true, bottom: false, left: true, right: false },
          dock: 'None',
          tabIndex: 12,
          visible: true,
          enabled: true,
        },
        // --- 구분선 (Panel) ---
        {
          id: 'pnlDivider',
          type: 'Panel',
          name: 'pnlDivider',
          position: { x: 20, y: 340 },
          size: { width: 400, height: 2 },
          properties: { backgroundColor: '#CCCCCC', borderStyle: 'None' },
          anchor: { top: true, bottom: false, left: true, right: false },
          dock: 'None',
          tabIndex: 13,
          visible: true,
          enabled: true,
        },
        // --- 상태 라벨 ---
        {
          id: 'lblStatus',
          type: 'Label',
          name: 'lblStatus',
          position: { x: 20, y: 355 },
          size: { width: 400, height: 23 },
          properties: { text: '', foreColor: '#d32f2f' },
          anchor: { top: true, bottom: false, left: true, right: false },
          dock: 'None',
          tabIndex: 14,
          visible: true,
          enabled: true,
        },
        // --- 버튼들 ---
        {
          id: 'btnSubmit',
          type: 'Button',
          name: 'btnSubmit',
          position: { x: 120, y: 390 },
          size: { width: 130, height: 35 },
          properties: { text: '가입하기', backgroundColor: '#1a73e8', foreColor: '#FFFFFF' },
          anchor: { top: true, bottom: false, left: true, right: false },
          dock: 'None',
          tabIndex: 15,
          visible: true,
          enabled: true,
        },
        {
          id: 'btnCancel',
          type: 'Button',
          name: 'btnCancel',
          position: { x: 270, y: 390 },
          size: { width: 130, height: 35 },
          properties: { text: '취소' },
          anchor: { top: true, bottom: false, left: true, right: false },
          dock: 'None',
          tabIndex: 16,
          visible: true,
          enabled: true,
        },
        // --- 프로그레스바 ---
        {
          id: 'prgLoading',
          type: 'ProgressBar',
          name: 'prgLoading',
          position: { x: 20, y: 445 },
          size: { width: 400, height: 20 },
          properties: { value: 0, minimum: 0, maximum: 100, style: 'Continuous' },
          anchor: { top: true, bottom: false, left: true, right: false },
          dock: 'None',
          tabIndex: 17,
          visible: false,
          enabled: true,
        },
      ],
      eventHandlers: [],
      dataBindings: [],
    });
    console.log('[seed] 폼 생성:', form._id.toString());
  } else {
    console.log('[seed] 폼 이미 존재:', form._id.toString());
  }

  // --- 3. 개발용 JWT 토큰 생성 ---
  const token = jwt.sign(
    { sub: SEED_USER, role: 'admin' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRY },
  );

  console.log('\n========================================');
  console.log('  샘플 데이터 시드 완료!');
  console.log('========================================');
  console.log(`  프로젝트 ID : ${project._id.toString()}`);
  console.log(`  폼 ID      : ${form._id.toString()}`);
  console.log(`  폼 상태    : ${form.status}`);
  console.log('');
  console.log('  [Runtime 테스트]');
  console.log(`  http://localhost:3001/?formId=${form._id.toString()}`);
  console.log('');
  console.log('  [API 테스트용 JWT 토큰]');
  console.log(`  ${token}`);
  console.log('');
  console.log('  [curl 예시]');
  console.log(`  curl -H "Authorization: Bearer ${token}" http://localhost:4000/api/forms`);
  console.log('========================================\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[seed] 실패:', err);
  process.exit(1);
});
