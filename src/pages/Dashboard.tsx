import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { Book, Users, Clock, AlertTriangle, ArrowRight, User as UserIcon, GraduationCap } from 'lucide-react';
import api from '../lib/api';
import { DashboardStats } from '../types';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import AnalyticsWorkspace from '../components/AnalyticsWorkspace';

/**
 * Primary Landing Dashboard.
 * Dynamically renders either the Student Portal (Quick Actions)
 * or the Librarian/Admin Workspace (Analytics & Management) based on the user's role.
 */
export default function Dashboard() {
  const { user } = useAuth();
  
  if (user?.role === 'student') {
    return (
      <div className="space-y-8">
        <header className="bg-lms-blue p-10 rounded-[3rem] text-white flex items-center justify-between relative overflow-hidden shadow-2xl shadow-blue-200">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full translate-x-32 -translate-y-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-lms-orange/20 rounded-full -translate-x-16 translate-y-16 blur-3xl" />
          <div className="relative z-10">
            <h1 className="text-5xl font-serif italic mb-3">Hello, {user.fullName.split(' ')[0]}!</h1>
            <p className="text-white/80 font-medium text-lg max-w-md">Your gateway to infinite knowledge. What are we exploring today?</p>
          </div>
          <div className="hidden lg:block relative z-10">
             <GraduationCap className="text-white opacity-20" size={160} />
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <QuickActionCard 
            title="Search Catalog" 
            desc="Explore our 10,000+ collection"
            icon={Book}
            link="/books"
            color="bg-lms-orange"
          />
          <QuickActionCard 
            title="My Borrowings" 
            desc="Manage active items & returns"
            icon={Clock}
            link="/history"
            color="bg-lms-green"
          />
          <QuickActionCard 
            title="Profile" 
            desc="Review your library account"
            icon={UserIcon}
            link="/profile"
            color="bg-lms-magenta"
          />
        </div>
      </div>
    );
  }

  // Fallback map to the comprehensive analytics workspace for Admins and Librarians.
  return <AnalyticsWorkspace />;
}

/**
 * Prop type definition for the QuickActionCard component.
 */
interface QuickActionCardProps {
  title: string;
  desc: string;
  icon: React.ElementType;
  link: string;
  color: string;
}

/**
 * Renders a visually accessible card link for quick navigation.
 */
function QuickActionCard({ title, desc, icon: Icon, link, color }: QuickActionCardProps) {
  return (
    <Link to={link} className="group">
      <div className="bg-white p-6 rounded-3xl border border-[#14141410] shadow-sm group-hover:shadow-lg transition-all transform group-hover:-translate-y-1 h-full">
        <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-[#1414141a]`}>
          <Icon size={24} />
        </div>
        <h3 className="text-xl font-bold mb-2 group-hover:text-lms-blue transition-colors">{title}</h3>
        <p className="text-gray-500 text-sm mb-6">{desc}</p>
        <div className="flex items-center gap-2 text-sm font-bold text-lms-blue">
          Go to {title} <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
