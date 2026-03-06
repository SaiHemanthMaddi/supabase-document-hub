import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { FileText, Home, Search, Bookmark, User, Settings } from 'lucide-react';

const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/documents', icon: FileText, label: 'Documents' },
    { to: '/search', icon: Search, label: 'Search' },
    { to: '/bookmarks', icon: Bookmark, label: 'Bookmarks' },
    { to: '/profile', icon: User, label: 'Profile' },
    { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
    const location = useLocation();

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card">
            <div className="flex h-16 items-center gap-2 border-b border-border px-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                    <FileText className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-lg font-semibold text-foreground">Document Hub</span>
            </div>
            <nav className="space-y-1 p-4">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.to;
                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                                isActive
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            )}
                        >
                            <Icon className="h-5 w-5" />
                            {item.label}
                        </NavLink>
                    );
                })}
            </nav>
        </aside>
    );
}
