import { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { Header } from './Header';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      {!isMobile && <Sidebar />}
      <div className={`flex flex-col ${!isMobile ? 'ml-64' : ''}`}>
        <Header />
        <main className={`flex-1 p-4 md:p-6 ${isMobile ? 'pb-20' : ''}`}>
          {children}
        </main>
      </div>
      {isMobile && <BottomNav />}
    </div>
  );
}
