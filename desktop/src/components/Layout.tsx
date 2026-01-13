import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Package, Bot, Terminal, Settings } from 'lucide-react';

export function Layout() {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/rule-packs', label: 'Rule Packs', icon: Package },
    { path: '/agents', label: 'Agents', icon: Bot },
    { path: '/commands', label: 'Commands', icon: Terminal },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen">
      <aside className="w-52 bg-slate-900 text-white">
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-xl font-bold">AgentsToolkit</h1>
        </div>
        <nav className="p-4">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded mb-1 ${
                location.pathname === item.path 
                  ? 'bg-slate-700' 
                  : 'hover:bg-slate-800'
              }`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
