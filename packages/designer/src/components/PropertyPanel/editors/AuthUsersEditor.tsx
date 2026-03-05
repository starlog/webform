import { useState } from 'react';

interface AuthUserEntry {
  username: string;
  password: string;
}

interface AuthUsersEditorProps {
  value: AuthUserEntry[];
  onChange: (value: AuthUserEntry[]) => void;
}

export function AuthUsersEditor({ value, onChange }: AuthUsersEditorProps) {
  const [open, setOpen] = useState(false);
  const items = Array.isArray(value) ? value : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '1px 2px',
          border: '1px solid #ccc',
          background: '#fff',
          fontSize: 12,
          fontFamily: 'Segoe UI, sans-serif',
          cursor: 'pointer',
        }}
      >
        (Users) [{items.length}]
      </button>
      {open && (
        <AuthUsersModal
          items={items}
          onClose={() => setOpen(false)}
          onSave={(newItems) => {
            onChange(newItems);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

interface AuthUsersModalProps {
  items: AuthUserEntry[];
  onClose: () => void;
  onSave: (items: AuthUserEntry[]) => void;
}

function AuthUsersModal({ items: initial, onClose, onSave }: AuthUsersModalProps) {
  const [items, setItems] = useState<AuthUserEntry[]>(() => initial.map((i) => ({ ...i })));
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [editingUsername, setEditingUsername] = useState('');

  const selectItem = (index: number) => {
    setSelectedIndex(index);
    if (index >= 0 && index < items.length) {
      setEditingUsername(items[index].username);
      setPassword('');
      setConfirmPassword('');
      setPasswordError('');
    }
  };

  const add = () => {
    const newItems = [...items, { username: '', password: '' }];
    setItems(newItems);
    selectItem(newItems.length - 1);
    setEditingUsername('');
    setPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const remove = () => {
    if (selectedIndex < 0 || selectedIndex >= items.length) return;
    const next = items.filter((_, i) => i !== selectedIndex);
    setItems(next);
    const newIdx = Math.min(selectedIndex, next.length - 1);
    setSelectedIndex(newIdx);
    if (newIdx >= 0 && newIdx < next.length) {
      setEditingUsername(next[newIdx].username);
    } else {
      setEditingUsername('');
    }
    setPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const applyChanges = () => {
    if (selectedIndex < 0 || selectedIndex >= items.length) return;
    if (password && password !== confirmPassword) {
      setPasswordError('비밀번호가 일치하지 않습니다');
      return;
    }
    setPasswordError('');
    const next = [...items];
    next[selectedIndex] = {
      username: editingUsername,
      password: password || next[selectedIndex].password,
    };
    setItems(next);
  };

  const handleSave = () => {
    // 현재 편집 중인 항목 적용
    if (selectedIndex >= 0 && selectedIndex < items.length) {
      if (password && password !== confirmPassword) {
        setPasswordError('비밀번호가 일치하지 않습니다');
        return;
      }
      const next = [...items];
      next[selectedIndex] = {
        username: editingUsername,
        password: password || next[selectedIndex].password,
      };
      onSave(next.filter((u) => u.username.trim() !== ''));
    } else {
      onSave(items.filter((u) => u.username.trim() !== ''));
    }
  };

  const selectedItem = selectedIndex >= 0 && selectedIndex < items.length ? items[selectedIndex] : null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        style={{
          width: 480,
          height: 400,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#fff',
          border: '1px solid #999',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: 12,
        }}
      >
        <div
          style={{
            padding: '6px 8px',
            backgroundColor: '#f0f0f0',
            borderBottom: '1px solid #ccc',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          Users Editor
        </div>
        <div style={{ padding: 8, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexShrink: 0 }}>
            <button type="button" onClick={add} style={btnStyle}>Add</button>
            <button type="button" onClick={remove} disabled={selectedIndex < 0} style={btnStyle}>Remove</button>
          </div>

          <div style={{ display: 'flex', gap: 8, flex: 1, overflow: 'hidden' }}>
            {/* 사용자 리스트 */}
            <div style={{ width: 160, minWidth: 160, overflow: 'auto', border: '1px solid #ccc' }}>
              {items.map((item, i) => (
                <div
                  key={i}
                  onClick={() => {
                    // 이전 항목 적용
                    applyChanges();
                    selectItem(i);
                  }}
                  style={{
                    padding: '3px 6px',
                    backgroundColor: i === selectedIndex ? '#0078d4' : i % 2 === 0 ? '#fff' : '#f9f9f9',
                    color: i === selectedIndex ? '#fff' : '#000',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.username || '(new user)'}
                </div>
              ))}
              {items.length === 0 && (
                <div style={{ padding: 8, color: '#999', textAlign: 'center' }}>No users</div>
              )}
            </div>

            {/* 속성 편집기 */}
            <div style={{ flex: 1, overflow: 'auto', border: '1px solid #ccc', padding: 8 }}>
              {selectedItem != null ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 2, fontWeight: 600, fontSize: 11 }}>
                      Username
                    </label>
                    <input
                      type="text"
                      value={editingUsername}
                      onChange={(e) => setEditingUsername(e.target.value)}
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 2, fontWeight: 600, fontSize: 11 }}>
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError('');
                      }}
                      placeholder={selectedItem.password ? '(unchanged - enter new to change)' : 'Enter password'}
                      style={inputStyle}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 2, fontWeight: 600, fontSize: 11 }}>
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordError('');
                      }}
                      placeholder="Re-enter password"
                      style={inputStyle}
                      autoComplete="new-password"
                    />
                  </div>
                  {passwordError && (
                    <div style={{ color: '#d32f2f', fontSize: 11 }}>{passwordError}</div>
                  )}
                </div>
              ) : (
                <div style={{ padding: 8, color: '#999', textAlign: 'center' }}>
                  Select a user
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ padding: '6px 8px', borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'flex-end', gap: 4, flexShrink: 0 }}>
          <button type="button" onClick={handleSave} style={btnStyle}>OK</button>
          <button type="button" onClick={onClose} style={btnStyle}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '2px 8px',
  border: '1px solid #ccc',
  backgroundColor: '#f0f0f0',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'Segoe UI, sans-serif',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  border: '1px solid #ccc',
  fontSize: 12,
  fontFamily: 'Segoe UI, sans-serif',
  boxSizing: 'border-box',
};
