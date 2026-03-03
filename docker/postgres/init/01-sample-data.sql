-- Sample database for WebForm PostgreSQL Demo

-- 직원 테이블
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    department VARCHAR(50) NOT NULL,
    position VARCHAR(50) NOT NULL,
    salary NUMERIC(10, 2) NOT NULL,
    hire_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- 부서 테이블
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    manager VARCHAR(100),
    budget NUMERIC(12, 2),
    location VARCHAR(100)
);

-- 프로젝트 테이블
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department_id INTEGER REFERENCES departments(id),
    status VARCHAR(20) DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    budget NUMERIC(12, 2)
);

-- 부서 데이터
INSERT INTO departments (name, manager, budget, location) VALUES
('Engineering', 'Kim Minho', 500000.00, 'Seoul'),
('Marketing', 'Park Jiyeon', 300000.00, 'Seoul'),
('Sales', 'Lee Sunwoo', 400000.00, 'Busan'),
('HR', 'Choi Yuna', 200000.00, 'Seoul'),
('Finance', 'Jang Hyunwoo', 350000.00, 'Incheon');

-- 직원 데이터
INSERT INTO employees (name, email, department, position, salary, hire_date, is_active) VALUES
('Kim Minho', 'minho.kim@example.com', 'Engineering', 'Director', 95000.00, '2018-03-15', true),
('Park Jiyeon', 'jiyeon.park@example.com', 'Marketing', 'Director', 88000.00, '2019-06-01', true),
('Lee Sunwoo', 'sunwoo.lee@example.com', 'Sales', 'Director', 90000.00, '2018-09-20', true),
('Choi Yuna', 'yuna.choi@example.com', 'HR', 'Director', 82000.00, '2020-01-10', true),
('Jang Hyunwoo', 'hyunwoo.jang@example.com', 'Finance', 'Director', 87000.00, '2019-11-05', true),
('Son Jihye', 'jihye.son@example.com', 'Engineering', 'Senior Developer', 78000.00, '2020-04-12', true),
('Han Seojun', 'seojun.han@example.com', 'Engineering', 'Developer', 65000.00, '2021-07-03', true),
('Yoo Nayoung', 'nayoung.yoo@example.com', 'Engineering', 'Developer', 62000.00, '2022-01-15', true),
('Bae Jongmin', 'jongmin.bae@example.com', 'Marketing', 'Marketing Manager', 72000.00, '2020-08-20', true),
('Shin Hayoon', 'hayoon.shin@example.com', 'Marketing', 'Designer', 58000.00, '2022-03-10', true),
('Kwon Daehyun', 'daehyun.kwon@example.com', 'Sales', 'Sales Manager', 75000.00, '2019-12-01', true),
('Im Soyeon', 'soyeon.im@example.com', 'Sales', 'Account Executive', 55000.00, '2023-02-14', true),
('Jung Wooseok', 'wooseok.jung@example.com', 'HR', 'HR Specialist', 52000.00, '2021-05-20', true),
('Oh Minji', 'minji.oh@example.com', 'Finance', 'Accountant', 60000.00, '2021-09-01', true),
('Seo Taehyung', 'taehyung.seo@example.com', 'Engineering', 'Junior Developer', 48000.00, '2024-01-08', true);

-- 프로젝트 데이터
INSERT INTO projects (name, department_id, status, start_date, end_date, budget) VALUES
('WebForm Platform v2', 1, 'active', '2024-01-01', '2024-12-31', 150000.00),
('Brand Renewal Campaign', 2, 'active', '2024-03-01', '2024-08-31', 80000.00),
('APAC Market Expansion', 3, 'active', '2024-02-15', '2024-11-30', 120000.00),
('Employee Wellness Program', 4, 'completed', '2023-06-01', '2024-03-31', 35000.00),
('ERP Migration', 5, 'active', '2024-04-01', '2025-03-31', 200000.00);
