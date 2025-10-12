// components/SidebarClientWrapper.tsx
'use client';

import { useState } from 'react';
import { LogOut, Menu } from 'lucide-react';

// Dati e JSX "statico" passati dal Server Component
interface SidebarClientWrapperProps {
    user: any; // Usa il tuo tipo User
    navigationItems: any[]; // Usa il tuo tipo per navigationItems
}

// 2.1 Componente Sidebar interattivo
function SidebarContent({ user, navigationItems, sidebarOpen }) {
    return (
        <div className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
            {/* ... tutto il markup della Sidebar (logo, navigazione, user) ... */}
            {/* Mantieni la struttura originale della tua Sidebar qui */}
            {/* ... */}
        </div>
    );
}

// 2.2 Componente Bottone Menu interattivo
// Per poter accedere allo stato della sidebar, il bottone deve essere qui o in un Context
export function SidebarClientWrapper({ user, navigationItems }: SidebarClientWrapperProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    return (
        <>
            {/* La Sidebar vera e propria */}
            <SidebarContent
                user={user}
                navigationItems={navigationItems}
                sidebarOpen={sidebarOpen}
            />
            
            {/* Il bottone mobile che apre la sidebar, posizionato nell'header */}
            <div className="lg:hidden absolute top-4 left-4 z-40">
                <button
                    onClick={toggleSidebar}
                    className="text-gray-400 hover:text-white"
                    aria-label="Open menu"
                >
                    <Menu className="w-6 h-6" />
                </button>
            </div>
        </>
    );
}