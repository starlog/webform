import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatabaseFormFields } from '../components/DataSourcePanel/DatabaseFormFields';
import type { DatabaseFormFieldsProps } from '../components/DataSourcePanel/DatabaseFormFields';

const mockStyles = {
  formGroup: {},
  formLabel: {},
  formInput: {},
  formCheckboxGroup: {},
};

function makeProps(overrides?: Partial<DatabaseFormFieldsProps>): DatabaseFormFieldsProps {
  return {
    dialect: 'postgresql',
    connectionString: '',
    onConnectionStringChange: vi.fn(),
    host: 'localhost',
    onHostChange: vi.fn(),
    port: '5432',
    onPortChange: vi.fn(),
    user: 'admin',
    onUserChange: vi.fn(),
    password: 'secret',
    onPasswordChange: vi.fn(),
    database: 'mydb',
    onDatabaseChange: vi.fn(),
    ssl: false,
    onSslChange: vi.fn(),
    styles: mockStyles,
    ...overrides,
  };
}

describe('DatabaseFormFields', () => {
  describe('MongoDB 모드', () => {
    it('Connection String과 Database 필드를 표시한다', () => {
      render(<DatabaseFormFields {...makeProps({ dialect: 'mongodb' })} />);

      expect(screen.getByText('Connection String')).toBeInTheDocument();
      expect(screen.getByText('Database')).toBeInTheDocument();
    });

    it('Host, Port, User, Password 필드는 표시하지 않는다', () => {
      render(<DatabaseFormFields {...makeProps({ dialect: 'mongodb' })} />);

      expect(screen.queryByText('Host')).not.toBeInTheDocument();
      expect(screen.queryByText('Port')).not.toBeInTheDocument();
      expect(screen.queryByText('User')).not.toBeInTheDocument();
      expect(screen.queryByText('Password')).not.toBeInTheDocument();
    });

    it('Connection String 값을 변경하면 콜백을 호출한다', () => {
      const onConnectionStringChange = vi.fn();
      render(
        <DatabaseFormFields
          {...makeProps({ dialect: 'mongodb', connectionString: '', onConnectionStringChange })}
        />,
      );

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: 'mongodb://localhost:27017' } });
      expect(onConnectionStringChange).toHaveBeenCalledWith('mongodb://localhost:27017');
    });

    it('showPlaceholders=true일 때 placeholder를 표시한다', () => {
      render(
        <DatabaseFormFields
          {...makeProps({ dialect: 'mongodb', showPlaceholders: true, connectionString: '', database: '' })}
        />,
      );

      expect(screen.getByPlaceholderText('mongodb://localhost:27017')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('mydb')).toBeInTheDocument();
    });

    it('showPlaceholders=false(기본값)이면 placeholder가 없다', () => {
      const { container } = render(
        <DatabaseFormFields {...makeProps({ dialect: 'mongodb', connectionString: '', database: '' })} />,
      );

      const inputs = container.querySelectorAll('input');
      inputs.forEach((input) => {
        expect(input.getAttribute('placeholder')).toBeNull();
      });
    });
  });

  describe('SQL DB 모드', () => {
    it('Host, Port, User, Password, Database, SSL 필드를 표시한다', () => {
      render(<DatabaseFormFields {...makeProps({ dialect: 'postgresql' })} />);

      expect(screen.getByText('Host')).toBeInTheDocument();
      expect(screen.getByText('Port')).toBeInTheDocument();
      expect(screen.getByText('User')).toBeInTheDocument();
      expect(screen.getByText('Password')).toBeInTheDocument();
      expect(screen.getByText('Database')).toBeInTheDocument();
      expect(screen.getByText('SSL')).toBeInTheDocument();
    });

    it('Connection String 필드는 표시하지 않는다', () => {
      render(<DatabaseFormFields {...makeProps({ dialect: 'mysql' })} />);
      expect(screen.queryByText('Connection String')).not.toBeInTheDocument();
    });

    it('Host 변경 시 콜백을 호출한다', () => {
      const onHostChange = vi.fn();
      render(<DatabaseFormFields {...makeProps({ onHostChange })} />);

      const hostInput = screen.getByDisplayValue('localhost');
      fireEvent.change(hostInput, { target: { value: '192.168.1.1' } });
      expect(onHostChange).toHaveBeenCalledWith('192.168.1.1');
    });

    it('SSL 체크박스 변경 시 콜백을 호출한다', () => {
      const onSslChange = vi.fn();
      render(<DatabaseFormFields {...makeProps({ onSslChange })} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(onSslChange).toHaveBeenCalledWith(true);
    });

    it('Port 필드가 number 타입이다', () => {
      render(<DatabaseFormFields {...makeProps()} />);
      const portInput = screen.getByDisplayValue('5432');
      expect(portInput.getAttribute('type')).toBe('number');
    });

    it('Password 필드가 password 타입이다', () => {
      render(<DatabaseFormFields {...makeProps()} />);
      const passwordInput = screen.getByDisplayValue('secret');
      expect(passwordInput.getAttribute('type')).toBe('password');
    });

    it('showPlaceholders + defaultPorts로 Port placeholder를 표시한다', () => {
      render(
        <DatabaseFormFields
          {...makeProps({
            dialect: 'mssql',
            port: '',
            showPlaceholders: true,
            defaultPorts: { mssql: '1433', postgresql: '5432' },
          })}
        />,
      );

      expect(screen.getByPlaceholderText('1433')).toBeInTheDocument();
    });
  });

  describe('dialect이 빈 문자열', () => {
    it('아무것도 렌더링하지 않는다', () => {
      const { container } = render(<DatabaseFormFields {...makeProps({ dialect: '' })} />);
      expect(container.innerHTML).toBe('');
    });
  });

  describe('다양한 SQL dialect', () => {
    for (const dialect of ['mysql', 'mssql', 'postgresql']) {
      it(`${dialect}에서 SQL 필드를 표시한다`, () => {
        render(<DatabaseFormFields {...makeProps({ dialect })} />);
        expect(screen.getByText('Host')).toBeInTheDocument();
        expect(screen.getByText('SSL')).toBeInTheDocument();
      });
    }
  });
});
