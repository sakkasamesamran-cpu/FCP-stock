import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  ArrowRightLeft, 
  ClipboardList, 
  Users, 
  Plus, 
  Trash2, 
  CheckCircle2,
  PackageOpen,
  PackageCheck,
  Clock,
  Download,
  Filter,
  Briefcase,
  Building,
  Cloud,
  CloudOff,
  LogOut,
  Lock,
  UserCircle,
  Search,
  Edit,
  X,
  Save,
  Key
} from 'lucide-react';

/* global __firebase_config, __app_id, __initial_auth_token */

// --- FIREBASE INITIALIZATION ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const App = () => {
  // --- STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [historyFilter, setHistoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit User State
  const [editingUserId, setEditingUserId] = useState(null);
  const [editUserName, setEditUserName] = useState('');
  
  // Role State
  const [currentUserRole, setCurrentUserRole] = useState(null); // 'admin' or 'user'
  
  // Auth & Cloud State
  const [user, setUser] = useState(null);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  
  // Admin Password State
  const [adminPassword, setAdminPassword] = useState('1234');
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  // Admin Login Lockout State
  const [loginAttempts, setLoginAttempts] = useState(() => parseInt(localStorage.getItem('adminLoginAttempts') || '0'));
  const [lockoutUntil, setLockoutUntil] = useState(() => parseInt(localStorage.getItem('adminLockoutUntil') || '0'));
  const [remainingLockoutTime, setRemainingLockoutTime] = useState(0);
  
  // App Data State (เริ่มต้นด้วยข้อมูลจำลอง)
  const [users, setUsers] = useState([
    { id: '1', name: 'สมชาย ช่างซ่อม' },
    { id: '2', name: 'สมหญิง ธุรการ' },
    { id: '3', name: 'วิชัย ไฟฟ้า' }
  ]);
  
  const [transactions, setTransactions] = useState([]);
  const [transactionItems, setTransactionItems] = useState(['']);

  // --- CLOUD DATABASE EFFECTS ---
  
  // 1. ระบบยืนยันตัวตน
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsCloudConnected(!!currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. โหลดข้อมูลรายชื่อผู้ใช้งานจาก Cloud
  useEffect(() => {
    if (!user || !db) return;
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (usersData.length > 0 || snapshot.metadata.hasPendingWrites) {
        setUsers(usersData);
      }
    }, (err) => console.error("Users sync error:", err));
    return () => unsubscribe();
  }, [user]);

  // 3. โหลดข้อมูลประวัติรายการจาก Cloud
  useEffect(() => {
    if (!user || !db) return;
    const transRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const unsubscribe = onSnapshot(transRef, (snapshot) => {
      const transData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      transData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (transData.length > 0 || snapshot.metadata.hasPendingWrites) {
        setTransactions(transData);
      }
    }, (err) => console.error("Transactions sync error:", err));
    return () => unsubscribe();
  }, [user]);

  // 4. โหลดรหัสผ่าน Admin จาก Cloud
  useEffect(() => {
    if (!user || !db) return;
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'adminConfig');
    const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().password) {
        setAdminPassword(docSnap.data().password);
      }
    }, (err) => console.error("Admin config sync error:", err));
    return () => unsubscribe();
  }, [user]);

  // 5. จัดการระบบล็อคการเข้าใช้งาน Admin (Lockout Timer)
  useEffect(() => {
    let interval;
    if (lockoutUntil > Date.now()) {
      setRemainingLockoutTime(Math.ceil((lockoutUntil - Date.now()) / 1000));
      interval = setInterval(() => {
        const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
        if (remaining <= 0) {
          setRemainingLockoutTime(0);
          setLockoutUntil(0);
          setLoginAttempts(0);
          localStorage.removeItem('adminLockoutUntil');
          localStorage.removeItem('adminLoginAttempts');
          clearInterval(interval);
        } else {
          setRemainingLockoutTime(remaining);
        }
      }, 1000);
    } else {
      setRemainingLockoutTime(0);
    }
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  // --- HANDLERS ---
  const handleAdminLogin = (e) => {
    e.preventDefault();
    
    if (lockoutUntil > Date.now()) {
      alert(`ไม่สามารถเข้าสู่ระบบได้ กรุณารออีก ${Math.ceil((lockoutUntil - Date.now()) / 60000)} นาที`);
      return;
    }

    const pin = e.target.pin.value;
    if (pin === adminPassword) {
      setCurrentUserRole('admin');
      setLoginAttempts(0);
      localStorage.removeItem('adminLoginAttempts');
      localStorage.removeItem('adminLockoutUntil');
    } else {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      localStorage.setItem('adminLoginAttempts', newAttempts.toString());
      
      if (newAttempts >= 3) {
        const lockTime = Date.now() + 5 * 60 * 1000; // 5 นาที (milliseconds)
        setLockoutUntil(lockTime);
        localStorage.setItem('adminLockoutUntil', lockTime.toString());
        alert('กรอกรหัสผ่านผิด 3 ครั้ง! ระบบได้ทำการล็อคการเข้าใช้งาน Admin เป็นเวลา 5 นาที');
      } else {
        alert(`รหัสผ่านไม่ถูกต้อง! (เหลือโอกาสอีก ${3 - newAttempts} ครั้ง)`);
      }
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    const current = e.target.currentPassword.value;
    const newPass = e.target.newPassword.value;
    const confirm = e.target.confirmPassword.value;

    if (current !== adminPassword) {
      alert('รหัสผ่านเดิมไม่ถูกต้อง!');
      return;
    }
    if (newPass !== confirm) {
      alert('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน!');
      return;
    }
    if (newPass.length < 4) {
      alert('รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร');
      return;
    }

    if (db) {
      try {
        const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'adminConfig');
        await setDoc(settingsRef, { password: newPass }, { merge: true });
      } catch (error) {
        console.error("Error updating password: ", error);
        alert("เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน");
        return;
      }
    } else {
      setAdminPassword(newPass);
    }

    alert('เปลี่ยนรหัสผ่านสำเร็จ!');
    setIsChangePasswordModalOpen(false);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    const name = e.target.elements.userName.value.trim();
    if (!name) return;

    if (db) {
      const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
      await addDoc(usersRef, { name });
    } else {
      setUsers([...users, { id: Date.now().toString(), name }]);
    }
    e.target.reset();
  };

  const handleDeleteUser = async (id) => {
    if (currentUserRole !== 'admin') {
      alert('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบผู้ใช้งานได้');
      return;
    }
    if (window.confirm('คุณต้องการลบรายชื่อนี้ใช่หรือไม่?')) {
      if (db && user) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', id));
        // เผื่อกรณีที่เป็นข้อมูลจำลอง ให้ลบออกจาก local state ด้วย
        setUsers(prev => prev.filter(u => u.id !== id));
      } else {
        setUsers(users.filter(u => u.id !== id));
      }
    }
  };

  const handleSaveEditUser = async (id) => {
    if (!editUserName.trim()) {
      alert('กรุณาระบุชื่อ-นามสกุล');
      return;
    }
    if (db && user) {
      try {
        const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', id);
        // ใช้ setDoc ร่วมกับ merge: true แทน updateDoc เผื่อกรณีที่เป็นข้อมูลจำลองที่ไม่มีใน Firebase 
        await setDoc(userRef, { name: editUserName.trim() }, { merge: true });
        // อัปเดตข้อมูลบนหน้าจอทันทีเผื่อยังไม่มีข้อมูลใน Cloud
        setUsers(prev => prev.map(u => u.id === id ? { ...u, name: editUserName.trim() } : u));
      } catch (error) {
        console.error("Error updating user: ", error);
        alert("เกิดข้อผิดพลาดในการแก้ไขข้อมูล");
      }
    } else {
      // Fallback local state
      setUsers(users.map(u => u.id === id ? { ...u, name: editUserName.trim() } : u));
    }
    setEditingUserId(null);
    setEditUserName('');
  };

  const handleDeleteTransaction = async (id) => {
    if (currentUserRole !== 'admin') {
      alert('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบประวัติได้');
      return;
    }
    if (window.confirm('คุณต้องการลบประวัติรายการนี้ใช่หรือไม่?')) {
      if (db && user) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', id));
      } else {
        setTransactions(transactions.filter(t => t.id !== id));
      }
    }
  };

  const handleItemChange = (index, value) => {
    const newItems = [...transactionItems];
    newItems[index] = value;
    setTransactionItems(newItems);
  };

  const handleAddItem = () => {
    setTransactionItems([...transactionItems, '']);
  };

  const handleRemoveItem = (index) => {
    const newItems = transactionItems.filter((_, i) => i !== index);
    setTransactionItems(newItems.length > 0 ? newItems : ['']);
  };

  const handleTransactionSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const userId = formData.get('userId');
    const workOrder = formData.get('workOrder').trim();
    const customerName = formData.get('customerName').trim();
    const type = formData.get('type');
    const purpose = formData.get('purpose');
    
    const validItems = transactionItems
      .map(item => item.trim())
      .filter(item => item.length > 0);

    if (!userId || !workOrder || !customerName || !purpose || validItems.length === 0) {
        alert('กรุณากรอกข้อมูลให้ครบถ้วน');
        return;
    }

    const formattedItems = validItems.map((item, index) => `${index + 1}. ${item}`).join('\n');
    const selectedUser = users.find(u => u.id === userId);
    
    const newTransaction = {
      userId,
      userName: selectedUser ? selectedUser.name : 'ผู้ใช้ที่ถูกลบ',
      type,
      purpose,
      workOrder,
      customerName,
      items: formattedItems,
      date: new Date().toISOString()
    };

    if (db) {
      const transRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
      await addDoc(transRef, newTransaction);
    } else {
      newTransaction.id = Date.now().toString();
      setTransactions([newTransaction, ...transactions]);
    }

    alert('บันทึกรายการลงฐานข้อมูลสำเร็จ');
    e.target.reset();
    setTransactionItems(['']);
    setHistoryFilter('ALL');
    setActiveTab('history');
  };

  const navigateToHistory = (filter) => {
    setHistoryFilter(filter);
    setActiveTab('history');
  };

  const handleExportExcel = () => {
    const filteredTransactions = transactions.filter(t => historyFilter === 'ALL' || t.type === historyFilter);

    if (filteredTransactions.length === 0) {
      alert('ไม่มีข้อมูลสำหรับ Export');
      return;
    }

    let csvContent = '\uFEFF'; 
    csvContent += "วัน/เวลา,เลข Work order,ชื่อลูกค้า,วัตถุประสงค์,ผู้ทำรายการ,ประเภท,รายการอะไหล่\n";

    filteredTransactions.forEach(t => {
      const date = new Date(t.date).toLocaleString('th-TH');
      const wo = `"${t.workOrder || '-'}"`;
      const customer = `"${t.customerName || '-'}"`;
      const purpose = t.purpose === 'ONSITE' ? 'ไปงานลูกค้า' : 'ทดสอบในออฟฟิศ';
      const name = t.userName;
      const type = t.type === 'BORROW' ? 'เบิก' : 'คืน';
      const items = `"${t.items.replace(/"/g, '""')}"`;
      csvContent += `${date},${wo},${customer},${purpose},${name},${type},${items}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ประวัติเบิกคืน_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- COMPUTED DATA ---
  const stats = useMemo(() => {
    const totalBorrows = transactions.filter(t => t.type === 'BORROW').length;
    const totalReturns = transactions.filter(t => t.type === 'RETURN').length;
    return { totalBorrows, totalReturns, totalTransactions: transactions.length, totalUsers: users.length };
  }, [transactions, users]);

  // --- COMPONENTS ---

  const DashboardTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">แดชบอร์ดสรุปภาพรวม</h2>
        
        <div className="flex items-center space-x-3">
          {currentUserRole === 'admin' && (
            <button 
              onClick={() => setIsChangePasswordModalOpen(true)} 
              className="flex items-center px-3 py-1.5 rounded-full text-xs font-medium border bg-white hover:bg-gray-50 text-gray-700 border-gray-200 shadow-sm transition-colors"
            >
              <Key size={14} className="mr-1.5 text-indigo-500" /> เปลี่ยนรหัสผ่าน Admin
            </button>
          )}
          <div className={`flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${isCloudConnected ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
             {isCloudConnected ? <Cloud size={14} className="mr-1.5" /> : <CloudOff size={14} className="mr-1.5" />}
             {isCloudConnected ? 'เชื่อมต่อฐานข้อมูล Cloud แล้ว' : 'ออฟไลน์ (ข้อมูลจำลอง)'}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div onClick={() => navigateToHistory('ALL')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><ClipboardList size={24} /></div>
          <div>
            <p className="text-sm text-gray-500">รายการทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-800">{stats.totalTransactions}</p>
          </div>
        </div>
        <div onClick={() => navigateToHistory('BORROW')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4 cursor-pointer hover:shadow-md hover:border-red-300 transition-all">
          <div className="p-3 bg-red-100 text-red-600 rounded-lg"><PackageOpen size={24} /></div>
          <div>
            <p className="text-sm text-gray-500">รายการเบิก (ครั้ง)</p>
            <p className="text-2xl font-bold text-gray-800">{stats.totalBorrows}</p>
          </div>
        </div>
        <div onClick={() => navigateToHistory('RETURN')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4 cursor-pointer hover:shadow-md hover:border-emerald-300 transition-all">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg"><PackageCheck size={24} /></div>
          <div>
            <p className="text-sm text-gray-500">รายการคืน (ครั้ง)</p>
            <p className="text-2xl font-bold text-gray-800">{stats.totalReturns}</p>
          </div>
        </div>
        <div onClick={() => currentUserRole === 'admin' ? setActiveTab('users') : null} className={`bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4 transition-all ${currentUserRole === 'admin' ? 'cursor-pointer hover:shadow-md hover:border-purple-300' : ''}`}>
          <div className="p-3 bg-purple-100 text-purple-600 rounded-lg"><Users size={24} /></div>
          <div>
            <p className="text-sm text-gray-500">จำนวนพนักงาน</p>
            <p className="text-2xl font-bold text-gray-800">{stats.totalUsers}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><Clock className="mr-2" size={20} /> รายการเคลื่อนไหวล่าสุด</h3>
        <div className="space-y-4">
          {transactions.slice(0, 5).map(t => (
            <div key={t.id} className="flex items-start p-4 bg-gray-50 rounded-lg border border-gray-100">
               <div className={`mt-1 mr-4 ${t.type === 'BORROW' ? 'text-red-500' : 'text-emerald-500'}`}>
                 {t.type === 'BORROW' ? <PackageOpen size={20} /> : <PackageCheck size={20} />}
               </div>
               <div className="flex-1">
                 <p className="font-medium text-gray-800">
                    <span className={`px-2 py-0.5 rounded text-xs mr-2 ${t.type === 'BORROW' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {t.type === 'BORROW' ? 'เบิก' : 'คืน'}
                    </span>
                    {t.userName}
                    <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded ${t.purpose === 'ONSITE' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                      {t.purpose === 'ONSITE' ? 'ไปงานลูกค้า' : 'ทดสอบในออฟฟิศ'}
                    </span>
                    <span className="ml-2 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">WO: {t.workOrder || '-'}</span>
                    <span className="ml-2 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">ลูกค้า: {t.customerName || '-'}</span>
                 </p>
                 <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{t.items}</p>
                 <p className="text-xs text-gray-400 mt-2">{new Date(t.date).toLocaleString('th-TH')}</p>
               </div>
            </div>
          ))}
          {transactions.length === 0 && <p className="text-gray-500 text-center py-4">ยังไม่มีรายการเคลื่อนไหว หรือกำลังโหลดข้อมูล...</p>}
        </div>
      </div>

      {/* Change Password Modal */}
      {isChangePasswordModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800 flex items-center">
                <Key size={20} className="mr-2 text-indigo-600" /> เปลี่ยนรหัสผ่าน Admin
              </h3>
              <button onClick={() => setIsChangePasswordModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20}/>
              </button>
            </div>
            <form onSubmit={handleChangePasswordSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่านเดิม *</label>
                <input type="password" name="currentPassword" required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500" placeholder="กรอกรหัสผ่านปัจจุบัน" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่านใหม่ *</label>
                <input type="password" name="newPassword" required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500" placeholder="ตั้งรหัสผ่านใหม่อย่างน้อย 4 ตัว" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ยืนยันรหัสผ่านใหม่ *</label>
                <input type="password" name="confirmPassword" required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500" placeholder="กรอกรหัสผ่านใหม่อีกครั้งให้ตรงกัน" />
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors">
                  บันทึกรหัสผ่านใหม่
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  const TransactionTab = () => (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg"><ArrowRightLeft size={24} /></div>
        <h2 className="text-2xl font-bold text-gray-800">ทำรายการเบิก / คืน</h2>
      </div>

      <form onSubmit={handleTransactionSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">เลือกผู้ทำรายการ *</label>
          <select name="userId" required className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white">
            <option value="">-- เลือกชื่อพนักงาน --</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">เลข Work order *</label>
          <input 
            type="text" 
            name="workOrder" 
            required 
            placeholder="เช่น WO-2023-001" 
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ชื่อลูกค้า / โครงการ *</label>
          <input 
            type="text" 
            name="customerName" 
            required 
            placeholder="ระบุชื่อลูกค้า หรือ โครงการ" 
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ประเภทรายการ *</label>
          <div className="grid grid-cols-2 gap-4">
            <label className="relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none hover:bg-gray-50 has-[:checked]:border-red-500 has-[:checked]:ring-1 has-[:checked]:ring-red-500">
              <input type="radio" name="type" value="BORROW" className="sr-only" defaultChecked />
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                    <PackageOpen className="text-red-500 mr-2" size={20} />
                    <span className="font-semibold text-gray-900">เบิกอะไหล่</span>
                </div>
              </div>
            </label>
            <label className="relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none hover:bg-gray-50 has-[:checked]:border-emerald-500 has-[:checked]:ring-1 has-[:checked]:ring-emerald-500">
              <input type="radio" name="type" value="RETURN" className="sr-only" />
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                    <PackageCheck className="text-emerald-500 mr-2" size={20} />
                    <span className="font-semibold text-gray-900">คืนอะไหล่</span>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">วัตถุประสงค์การนำไปใช้ *</label>
          <div className="grid grid-cols-2 gap-4">
            <label className="relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none hover:bg-gray-50 has-[:checked]:border-blue-500 has-[:checked]:ring-1 has-[:checked]:ring-blue-500">
              <input type="radio" name="purpose" value="ONSITE" className="sr-only" required />
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                    <Briefcase className="text-blue-500 mr-2" size={20} />
                    <span className="font-semibold text-gray-900">ไปงานลูกค้า</span>
                </div>
              </div>
            </label>
            <label className="relative flex cursor-pointer rounded-lg border bg-white p-4 shadow-sm focus:outline-none hover:bg-gray-50 has-[:checked]:border-purple-500 has-[:checked]:ring-1 has-[:checked]:ring-purple-500">
              <input type="radio" name="purpose" value="OFFICE" className="sr-only" required />
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                    <Building className="text-purple-500 mr-2" size={20} />
                    <span className="font-semibold text-gray-900">ทดสอบในออฟฟิศ</span>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-end mb-2">
            <label className="block text-sm font-medium text-gray-700">รายละเอียดอะไหล่ (Free-text) *</label>
          </div>
          
          <div className="space-y-3">
            {transactionItems.map((item, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="flex-none pt-3 text-sm font-medium text-gray-400 w-5">
                  {index + 1}.
                </div>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleItemChange(index, e.target.value)}
                  placeholder="ระบุชื่ออะไหล่และจำนวน..."
                  className="flex-1 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required={index === 0 && transactionItems.length === 1}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="flex-none p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="ลบรายการนี้"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="mt-3 text-sm text-indigo-600 font-medium flex items-center hover:text-indigo-800 bg-indigo-50 px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} className="mr-1" /> เพิ่มช่องรายการอะไหล่
          </button>
        </div>

        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition duration-150">
          <CheckCircle2 className="mr-2" size={20} /> ยืนยันการทำรายการ (บันทึกขึ้น Cloud)
        </button>
      </form>
    </div>
  );

  const HistoryTab = () => {
    const filteredTransactions = transactions.filter(t => {
      const matchType = historyFilter === 'ALL' || t.type === historyFilter;
      if (!matchType) return false;

      if (!searchQuery) return true;
      
      const q = searchQuery.toLowerCase();
      const searchString = `
        ${new Date(t.date).toLocaleString('th-TH')} 
        ${t.workOrder || ''} 
        ${t.customerName || ''} 
        ${t.purpose === 'ONSITE' ? 'ไปงานลูกค้า' : 'ทดสอบในออฟฟิศ'} 
        ${t.userName} 
        ${t.type === 'BORROW' ? 'เบิก' : 'คืน'} 
        ${t.items}
      `.toLowerCase();
      
      return searchString.includes(q);
    });

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gray-100 text-gray-600 rounded-lg"><ClipboardList size={20} /></div>
            <h2 className="text-xl font-bold text-gray-800">บันทึกประวัติย้อนหลัง</h2>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:flex-none sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="ค้นหาจากทุกข้อมูล..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <button
              onClick={handleExportExcel}
              className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors shadow-sm"
              title="ดาวน์โหลดเป็นไฟล์ Excel (CSV)"
            >
              <Download size={16} className="mr-2" />
              Export Excel
            </button>
            <div className="flex space-x-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
              <button 
                onClick={() => setHistoryFilter('ALL')} 
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${historyFilter === 'ALL' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
              >
                ทั้งหมด
              </button>
              <button 
                onClick={() => setHistoryFilter('BORROW')} 
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center ${historyFilter === 'BORROW' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Filter size={14} className="mr-1" /> เบิก
              </button>
              <button 
                onClick={() => setHistoryFilter('RETURN')} 
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center ${historyFilter === 'RETURN' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Filter size={14} className="mr-1" /> คืน
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider border-b border-gray-200">
                <th className="p-4 font-medium">วัน/เวลา</th>
                <th className="p-4 font-medium">เลข Work order</th>
                <th className="p-4 font-medium">ชื่อลูกค้า</th>
                <th className="p-4 font-medium">วัตถุประสงค์</th>
                <th className="p-4 font-medium">ผู้ทำรายการ</th>
                <th className="p-4 font-medium">ประเภท</th>
                <th className="p-4 font-medium">รายการอะไหล่</th>
                {currentUserRole === 'admin' && <th className="p-4 font-medium text-center">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filteredTransactions.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 whitespace-nowrap text-sm">{new Date(t.date).toLocaleString('th-TH')}</td>
                  <td className="p-4 whitespace-nowrap font-medium text-indigo-600">{t.workOrder || '-'}</td>
                  <td className="p-4 whitespace-nowrap text-gray-800">{t.customerName || '-'}</td>
                  <td className="p-4 whitespace-nowrap text-gray-700">
                    <div className="flex items-center">
                      {t.purpose === 'ONSITE' ? <Briefcase size={16} className="text-blue-500 mr-2"/> : <Building size={16} className="text-purple-500 mr-2"/>}
                      {t.purpose === 'ONSITE' ? 'ไปงานลูกค้า' : 'ทดสอบในออฟฟิศ'}
                    </div>
                  </td>
                  <td className="p-4 whitespace-nowrap font-medium">{t.userName}</td>
                  <td className="p-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${t.type === 'BORROW' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {t.type === 'BORROW' ? 'เบิก' : 'คืน'}
                      </span>
                  </td>
                  <td className="p-4">
                      <div className="whitespace-pre-wrap text-sm max-w-xl">{t.items}</div>
                  </td>
                  {currentUserRole === 'admin' && (
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleDeleteTransaction(t.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors inline-flex items-center"
                        title="ลบรายการนี้"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                  <tr>
                      <td colSpan={currentUserRole === 'admin' ? "8" : "7"} className="p-8 text-center text-gray-500">ไม่พบประวัติการทำรายการ</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const UsersTab = () => {
    if (currentUserRole !== 'admin') {
      return <div className="p-8 text-center text-gray-500">เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเข้าถึงหน้านี้ได้</div>;
    }
    
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <div className="p-2 bg-purple-100 text-purple-600 rounded-lg mr-3"><Users size={24} /></div>
          จัดการรายชื่อผู้เบิก/คืน
        </h2>

        {/* Add User Form */}
        <form onSubmit={handleAddUser} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">เพิ่มชื่อ-นามสกุล ผู้ใช้งานใหม่</label>
            <input 
              type="text" 
              name="userName" 
              required 
              placeholder="เช่น สมศักดิ์ ใจดี" 
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium flex items-center w-full sm:w-auto justify-center transition duration-150">
            <Plus size={20} className="mr-2" /> เพิ่มรายชื่อลงฐานข้อมูล
          </button>
        </form>

        {/* Users List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider border-b border-gray-200">
                <th className="p-4 font-medium w-16 text-center">#</th>
                <th className="p-4 font-medium">ชื่อ-นามสกุล</th>
                <th className="p-4 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {users.map((u, index) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="p-4 text-center text-gray-500">{index + 1}</td>
                  <td className="p-4 font-medium">
                    {editingUserId === u.id ? (
                      <input
                        type="text"
                        value={editUserName}
                        onChange={(e) => setEditUserName(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 text-sm"
                        autoFocus
                      />
                    ) : (
                      u.name
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {editingUserId === u.id ? (
                      <div className="flex justify-end space-x-1">
                        <button 
                          onClick={() => handleSaveEditUser(u.id)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 p-2 rounded-lg transition-colors inline-flex items-center"
                          title="บันทึก"
                        >
                          <Save size={18} />
                        </button>
                        <button 
                          onClick={() => { setEditingUserId(null); setEditUserName(''); }}
                          className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-lg transition-colors inline-flex items-center"
                          title="ยกเลิก"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end space-x-1">
                        <button 
                          onClick={() => { setEditingUserId(u.id); setEditUserName(u.name); }}
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors inline-flex items-center"
                          title="แก้ไขชื่อ"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors inline-flex items-center"
                          title="ลบรายชื่อ"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                  <tr>
                      <td colSpan="3" className="p-8 text-center text-gray-500">ไม่มีรายชื่อผู้ใช้งาน หรือกำลังโหลดข้อมูล...</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- MAIN LAYOUT ---
  if (!currentUserRole) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          <div className="bg-indigo-600 p-8 text-center">
            <PackageOpen size={56} className="mx-auto text-white mb-4" />
            <h1 className="text-3xl font-bold text-white">PartsSystem</h1>
            <p className="text-indigo-200 mt-2 text-sm">ระบบจัดการเบิก-คืนอะไหล่อุปกรณ์</p>
          </div>
          <div className="p-8 space-y-6">
            <h2 className="text-center text-gray-800 font-semibold text-lg border-b pb-4">กรุณาเลือกสิทธิ์การเข้าใช้งาน</h2>
            
            <button 
              onClick={() => setCurrentUserRole('user')}
              className="w-full flex items-center justify-center space-x-3 bg-white border-2 border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 text-gray-700 p-4 rounded-xl transition-all shadow-sm"
            >
              <UserCircle size={24} className="text-indigo-500" />
              <span className="font-medium text-lg">เข้าใช้งานทั่วไป (User)</span>
            </button>

            <div className="pt-6 border-t mt-6">
              {remainingLockoutTime > 0 ? (
                <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                  <Lock size={24} className="mx-auto text-red-500 mb-2" />
                  <p className="text-red-700 font-medium">ระงับการเข้าสู่ระบบ Admin ชั่วคราว</p>
                  <p className="text-sm text-red-600 mt-1">
                    กรุณารอ {Math.floor(remainingLockoutTime / 60)}:{(remainingLockoutTime % 60).toString().padStart(2, '0')} นาที
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-3 text-center">สำหรับผู้ดูแลระบบ (ค่าเริ่มต้น 1234)</p>
                  <form onSubmit={handleAdminLogin} className="flex flex-col space-y-2">
                    <div className="flex space-x-2">
                      <input 
                        type="password" 
                        name="pin" 
                        placeholder="ใส่รหัสผ่าน Admin..." 
                        className="flex-1 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-slate-800"
                        required
                      />
                      <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white px-5 rounded-lg font-medium flex items-center transition-colors shadow-sm">
                        <Lock size={18} className="mr-2" /> Admin
                      </button>
                    </div>
                    {loginAttempts > 0 && (
                      <p className="text-xs text-red-500 text-center">
                        แจ้งเตือน: กรอกรหัสผิดไปแล้ว {loginAttempts}/3 ครั้ง
                      </p>
                    )}
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 md:min-h-screen flex flex-col shadow-xl flex-shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white flex items-center">
            <PackageOpen className="mr-2 text-indigo-400" /> PartsSystem
          </h1>
          <p className="text-xs mt-2 text-slate-500">ระบบเบิก-คืนอะไหล่อุปกรณ์</p>
          <div className="mt-4 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            <UserCircle size={14} className="mr-1.5" />
            สถานะ: {currentUserRole === 'admin' ? 'Admin' : 'User'}
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'แดชบอร์ดสรุป', icon: LayoutDashboard },
            { id: 'transaction', label: 'เบิก / คืน อะไหล่', icon: ArrowRightLeft },
            { id: 'history', label: 'ประวัติย้อนหลัง', icon: ClipboardList },
            { id: 'users', label: 'จัดการผู้ใช้งาน', icon: Users, adminOnly: true },
          ]
          .filter(item => !item.adminOnly || currentUserRole === 'admin')
          .map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.id 
                  ? 'bg-indigo-600 text-white' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={20} className="mr-3" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => {
              setCurrentUserRole(null);
              setActiveTab('dashboard');
            }}
            className="w-full flex items-center justify-center px-4 py-2 bg-slate-800 hover:bg-red-600 hover:text-white rounded-lg text-sm font-medium transition-colors text-slate-400"
          >
            <LogOut size={16} className="mr-2" /> ออกจากระบบ
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'transaction' && <TransactionTab />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'users' && <UsersTab />}
      </main>

    </div>
  );
};

export default App;