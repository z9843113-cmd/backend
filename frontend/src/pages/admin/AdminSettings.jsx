import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI, userAPI } from '../../services/api';
import { useAuthStore } from '../../store';
import AdminNotificationBell from '../../components/AdminNotificationBell';

const AdminSettings = () => {
  const [, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ usdtRate: 83, tokenRate: 0.01, minJTokenBuy: 10, referralPercent: 5, jTokenCommissionPercent: 4, usdtCommissionPercent: 0, upiRewardAmount: 50, bankRewardAmount: 100, telegramRewardAmount: 25 });
  const [bannerData, setBannerData] = useState({ bannerEnabled: true, bannerTitle: 'Welcome Bonus', bannerSubtitle: 'Get 50% extra on first deposit', bannerButtonText: 'Claim Now', bannerLink: '/deposit' });
  const [supportLinks, setSupportLinks] = useState({ whatsappSupport: '', telegramSupport: '', telegramGroup: '' });
  const [savingSupport, setSavingSupport] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [bannerMessage, setBannerMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => { fetchSettings(); fetchSupportLinks(); }, []);
  const fetchSettings = async () => { try { const res = await adminAPI.getSettings(); const data = res?.data || res || {}; setSettings(data); setFormData({ usdtRate: parseFloat(data.usdtrate) || 83, tokenRate: parseFloat(data.tokenrate) || 0.01, minJTokenBuy: parseFloat(data.minjtokenbuy) || 10, referralPercent: parseFloat(data.referralpercent) || 5, jTokenCommissionPercent: parseFloat(data.jtokencommissionpercent) || 4, usdtCommissionPercent: parseFloat(data.usdtcommissionpercent) || 0, upiRewardAmount: parseFloat(data.upirewardamount) || 50, bankRewardAmount: parseFloat(data.bankrewardamount) || 100, telegramRewardAmount: parseFloat(data.telegramrewardamount) || 25 }); setBannerData({ bannerEnabled: data.bannerenabled !== false, bannerTitle: data.bannertitle || 'Welcome Bonus', bannerSubtitle: data.bannersubtitle || 'Get 50% extra on first deposit', bannerButtonText: data.bannerbuttontext || 'Claim Now', bannerLink: data.bannerlink || '/deposit' }); } catch { console.error('Failed to fetch settings'); } finally { setLoading(false); } };
  const fetchSupportLinks = async () => { try { const res = await adminAPI.getSupportLinks(); const data = res?.data || res || {}; setSupportLinks({ whatsappSupport: data.whatsappSupport || '', telegramSupport: data.telegramSupport || '', telegramGroup: data.telegramGroup || '' }); } catch { console.error('Failed to fetch support links'); } };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try { await adminAPI.updateSettings(formData); setMessage('Settings updated successfully!'); }
    catch { setMessage('Failed to update settings'); }
    finally { setSaving(false); }
  };

  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    setSavingSupport(true);
    setSupportMessage('');
    try { await adminAPI.updateSupportLinks(supportLinks); setSupportMessage('Support links updated successfully!'); }
    catch { setSupportMessage('Failed to update support links'); }
    finally { setSavingSupport(false); }
  };

  const handleBannerSubmit = async (e) => {
    e.preventDefault();
    setSavingBanner(true);
    setBannerMessage('');
    try { await adminAPI.updateSettings(bannerData); setBannerMessage('Banner settings updated successfully!'); }
    catch { setBannerMessage('Failed to update banner settings'); }
    finally { setSavingBanner(false); }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage('New passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setPasswordMessage('Password must be at least 6 characters');
      return;
    }
    setSavingPassword(true);
    setPasswordMessage('');
    try {
      await userAPI.updatePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      setPasswordMessage('Password updated successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordMessage(err.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  const menuItems = [
    { icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v-6a1 1 0 00-1-1h-3m-9 16v2a1 1 0 001 1h2', label: 'Home', path: '/admin/dashboard' },
    { icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', label: 'Users', path: '/admin/users' },
    { icon: 'M12 4v16m8-8H4', label: 'Deposits', path: '/admin/deposits' },
    { icon: 'M20 12H4', label: 'Withdraw', path: '/admin/withdrawals' },
    { icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z', label: 'UPI Apps', path: '/admin/upi-apps' },
    { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', label: 'UPI Verify', path: '/admin/upi-verifications' },
    { icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Crypto', path: '/admin/crypto' },
    { icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'J Token', path: '/admin/jtoken' },
    { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', label: 'History', path: '/admin/jtoken-history' },
    { icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', label: 'Settings', path: '/admin/settings' },
  ];

  const handleLogout = () => { logout(); navigate('/login'); };

  if (loading) return (<div className="min-h-screen bg-[#0a0a0a] p-5 font-['Ubuntu',sans-serif]"><div className="animate-pulse space-y-5"><div className="h-12 w-32 bg-[#1a1a1a] rounded-2xl"></div><div className="h-64 bg-[#1a1a1a] rounded-3xl"></div></div></div>);

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-24 lg:pb-8 font-['Ubuntu',sans-serif]">
      {sidebarOpen && <div className="fixed inset-0 bg-black/80 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className={`fixed top-0 left-0 h-full w-80 bg-[#0d0d0d] z-50 transform transition-transform duration-300 lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <div><h2 className="text-2xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#FFD700] bg-clip-text text-transparent">𝙅𝙀𝙓 𝙋𝘼𝙔</h2><p className="text-xs text-gray-500">Admin Panel</p></div>
            <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-xl bg-[#1a1a1a]"><svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        </div>
        <div className="p-4 space-y-2">
          {menuItems.map((item, index) => (<button key={index} onClick={() => { navigate(item.path); setSidebarOpen(false); }} className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-[#1a1a1a]/50 hover:bg-[#D4AF37]/10 text-left transition-all group"><div className="w-10 h-10 rounded-xl bg-[#1a1a1a] group-hover:bg-[#D4AF37]/20 flex items-center justify-center"><svg className="w-5 h-5 text-[#D4AF37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg></div><span className="text-white font-medium">{item.label}</span></button>))}
          <hr className="border-[#2a2a2a] my-4" />
          <button onClick={handleLogout} className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-left transition-all"><div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center"><svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></div><span className="text-red-400 font-medium">Logout</span></button>
        </div>
      </div>
      <div className="sticky top-0 z-30 bg-[#0d0d0d]/80 backdrop-blur-2xl border-b border-[#1a1a1a]">
        <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-5 sm:py-4">
          <button onClick={() => setSidebarOpen(true)} className="rounded-xl sm:rounded-2xl bg-[#1a1a1a] p-2.5 sm:p-3 hover:bg-[#252525]"><svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
          <h1 className="min-w-0 flex-1 truncate text-center text-base sm:text-xl font-bold text-white">Settings</h1>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <AdminNotificationBell />
            <button onClick={handleLogout} className="rounded-xl sm:rounded-2xl bg-red-500/10 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-red-400 hover:bg-red-500/20">Logout</button>
          </div>
        </div>
      </div>
      <div className="p-5 space-y-5 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-white">Settings</h1>
        
        {message && <div className={`px-5 py-3 rounded-2xl ${message.includes('success') ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>{message}</div>}
        
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-3xl p-6 border border-[#2a2a2a]">
          <h3 className="text-lg font-semibold text-white mb-6">Rate Settings</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-gray-400 text-sm mb-2">USDT Rate (₹)</label><input type="number" step="0.01" value={formData.usdtRate} onChange={(e) => setFormData({ ...formData, usdtRate: parseFloat(e.target.value) })} className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none" /></div>
              <div><label className="block text-gray-400 text-sm mb-2">Token Rate (₹)</label><input type="number" step="0.01" value={formData.tokenRate} onChange={(e) => setFormData({ ...formData, tokenRate: parseFloat(e.target.value) })} className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none" /></div>
            </div>
            <div><label className="block text-gray-400 text-sm mb-2">Minimum J Token Buy (INR)</label><input type="number" step="0.01" value={formData.minJTokenBuy} onChange={(e) => setFormData({ ...formData, minJTokenBuy: parseFloat(e.target.value) })} className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none" /></div>
            <div><label className="block text-gray-400 text-sm mb-2">Referral Commission (%)</label><input type="number" step="0.1" value={formData.referralPercent} onChange={(e) => setFormData({ ...formData, referralPercent: parseFloat(e.target.value) })} className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-gray-400 text-sm mb-2">J Token Commission (%)</label><input type="number" step="0.1" value={formData.jTokenCommissionPercent} onChange={(e) => setFormData({ ...formData, jTokenCommissionPercent: parseFloat(e.target.value) })} className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none" /></div>
              <div><label className="block text-gray-400 text-sm mb-2">USDT Commission (%)</label><input type="number" step="0.1" value={formData.usdtCommissionPercent} onChange={(e) => setFormData({ ...formData, usdtCommissionPercent: parseFloat(e.target.value) })} className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none" /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-gray-400 text-sm mb-2">UPI Reward (₹)</label><input type="number" value={formData.upiRewardAmount} onChange={(e) => setFormData({ ...formData, upiRewardAmount: parseFloat(e.target.value) })} className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none" /></div>
              <div><label className="block text-gray-400 text-sm mb-2">Bank Reward (₹)</label><input type="number" value={formData.bankRewardAmount} onChange={(e) => setFormData({ ...formData, bankRewardAmount: parseFloat(e.target.value) })} className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none" /></div>
              <div><label className="block text-gray-400 text-sm mb-2">Telegram Reward (₹)</label><input type="number" value={formData.telegramRewardAmount} onChange={(e) => setFormData({ ...formData, telegramRewardAmount: parseFloat(e.target.value) })} className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none" /></div>
            </div>
            <button type="submit" disabled={saving} className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black font-bold rounded-2xl disabled:opacity-50">{saving ? 'Saving...' : 'Save Settings'}</button>
          </form>
        </div>

        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-3xl p-6 border border-[#2a2a2a]">
          <h3 className="text-lg font-semibold text-white mb-6">Support Links</h3>
          <p className="text-gray-400 text-sm mb-4">Set links for customer support that users will see on their Profile page.</p>
          
          {supportMessage && <div className={`mb-4 px-4 py-2 rounded-xl ${supportMessage.includes('success') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{supportMessage}</div>}
          
          <form onSubmit={handleSupportSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">WhatsApp Support Link</label>
              <input 
                type="text" 
                value={supportLinks.whatsappSupport} 
                onChange={(e) => setSupportLinks({ ...supportLinks, whatsappSupport: e.target.value })} 
                placeholder="https://wa.me/919999999999"
                className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Telegram Support Link</label>
              <input 
                type="text" 
                value={supportLinks.telegramSupport} 
                onChange={(e) => setSupportLinks({ ...supportLinks, telegramSupport: e.target.value })} 
                placeholder="https://t.me/zcryptosupport"
                className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Telegram Group Link</label>
              <input 
                type="text" 
                value={supportLinks.telegramGroup} 
                onChange={(e) => setSupportLinks({ ...supportLinks, telegramGroup: e.target.value })} 
                placeholder="https://t.me/zcryptogroup"
                className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none" 
              />
            </div>
            <button type="submit" disabled={savingSupport} className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold rounded-2xl disabled:opacity-50">{savingSupport ? 'Saving...' : 'Save Support Links'}</button>
          </form>
        </div>

        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-3xl p-6 border border-[#2a2a2a]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Home Page Banner</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-gray-400 text-sm">Enable</span>
              <div className="relative">
                <input 
                  type="checkbox" 
                  checked={bannerData.bannerEnabled}
                  onChange={(e) => setBannerData({ ...bannerData, bannerEnabled: e.target.checked })}
                  className="sr-only"
                />
                <div className={`w-12 h-7 rounded-full transition-colors ${bannerData.bannerEnabled ? 'bg-green-500' : 'bg-gray-600'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform mt-1 ${bannerData.bannerEnabled ? 'translate-x-6 ml-0.5' : 'translate-x-1'}`} />
                </div>
              </div>
            </label>
          </div>
          <p className="text-gray-400 text-sm mb-4">Control the promotional banner shown on the home page.</p>
          
          {bannerMessage && <div className={`mb-4 px-4 py-2 rounded-xl ${bannerMessage.includes('success') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{bannerMessage}</div>}
          
          <form onSubmit={handleBannerSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Banner Title</label>
              <input 
                type="text" 
                value={bannerData.bannerTitle} 
                onChange={(e) => setBannerData({ ...bannerData, bannerTitle: e.target.value })} 
                placeholder="Welcome Bonus"
                className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Banner Subtitle</label>
              <input 
                type="text" 
                value={bannerData.bannerSubtitle} 
                onChange={(e) => setBannerData({ ...bannerData, bannerSubtitle: e.target.value })} 
                placeholder="Get 50% extra on first deposit"
                className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Button Text</label>
                <input 
                  type="text" 
                  value={bannerData.bannerButtonText} 
                  onChange={(e) => setBannerData({ ...bannerData, bannerButtonText: e.target.value })} 
                  placeholder="Claim Now"
                  className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none" 
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Button Link</label>
                <select 
                  value={bannerData.bannerLink} 
                  onChange={(e) => setBannerData({ ...bannerData, bannerLink: e.target.value })} 
                  className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none"
                >
                  <option value="/deposit">Deposit Page</option>
                  <option value="/exchange">Exchange Page</option>
                  <option value="/team">Team Page</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={savingBanner} className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black font-bold rounded-2xl disabled:opacity-50">{savingBanner ? 'Saving...' : 'Save Banner'}</button>
          </form>
        </div>

        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-3xl p-6 border border-[#2a2a2a]">
          <h3 className="text-lg font-semibold text-white mb-6">Change Admin Password</h3>
          <p className="text-gray-400 text-sm mb-4">Change the password of your administrator account.</p>
          
          {passwordMessage && (
            <div className={`mb-4 px-4 py-2 rounded-xl ${passwordMessage.includes('successfully') ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
              {passwordMessage}
            </div>
          )}
          
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Current Password</label>
              <input 
                type="password" 
                required
                value={passwordData.currentPassword} 
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })} 
                placeholder="••••••••"
                className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">New Password</label>
              <input 
                type="password" 
                required
                value={passwordData.newPassword} 
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} 
                placeholder="••••••••"
                className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Confirm New Password</label>
              <input 
                type="password" 
                required
                value={passwordData.confirmPassword} 
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} 
                placeholder="••••••••"
                className="w-full px-5 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl text-white focus:border-[#D4AF37] focus:outline-none" 
              />
            </div>
            <button type="submit" disabled={savingPassword} className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black font-bold rounded-2xl disabled:opacity-50">{savingPassword ? 'Saving...' : 'Change Password'}</button>
          </form>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-[#0d0d0d]/95 backdrop-blur-2xl border-t border-[#1a1a1a] lg:hidden z-50">
        <div className="flex items-center justify-around py-2 px-1">
          <button onClick={() => navigate('/admin/dashboard')} className="flex flex-col items-center gap-1.5 p-2 text-gray-500"><div className="w-10 h-10 rounded-2xl bg-[#1a1a1a] flex items-center justify-center"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg></div><span className="text-xs font-medium">Home</span></button>
          <button onClick={() => navigate('/admin/users')} className="flex flex-col items-center gap-1.5 p-2 text-gray-500"><div className="w-10 h-10 rounded-2xl bg-[#1a1a1a] flex items-center justify-center"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg></div><span className="text-xs font-medium">Users</span></button>
          <button onClick={() => navigate('/admin/deposits')} className="flex flex-col items-center gap-1.5 p-2 text-gray-500"><div className="w-10 h-10 rounded-2xl bg-[#1a1a1a] flex items-center justify-center"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></div><span className="text-xs font-medium">Deposits</span></button>
          <button onClick={() => navigate('/admin/withdrawals')} className="flex flex-col items-center gap-1.5 p-2 text-gray-500"><div className="w-10 h-10 rounded-2xl bg-[#1a1a1a] flex items-center justify-center"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg></div><span className="text-xs font-medium">Withdraw</span></button>
          <button onClick={() => navigate('/admin/jtoken')} className="flex flex-col items-center gap-1.5 p-2 text-gray-500"><div className="w-10 h-10 rounded-2xl bg-[#1a1a1a] flex items-center justify-center"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div><span className="text-xs font-medium">J Token</span></button>
          <button onClick={() => navigate('/admin/settings')} className="flex flex-col items-center gap-1.5 p-2 text-[#D4AF37]"><div className="w-10 h-10 rounded-2xl bg-[#D4AF37]/20 flex items-center justify-center"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg></div><span className="text-xs font-medium">Settings</span></button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
