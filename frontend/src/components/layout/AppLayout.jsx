import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout({ user, onLogout, children }) {
    return (
        <div className="flex h-screen w-screen overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <aside className="h-full shrink-0 overflow-y-auto">
                <Sidebar user={user} />
            </aside>

            <div className="flex min-w-0 flex-1 flex-col h-full">
                <header className="w-full shrink-0 z-40">
                    <Topbar user={user} onLogout={onLogout} />
                </header>

                <main className="w-full flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                    <div className="mx-auto max-w-[1400px]">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}