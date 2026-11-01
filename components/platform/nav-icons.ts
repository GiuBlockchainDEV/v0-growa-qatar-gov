/* Icon names used by the navigation registry, resolved to Lucide icons.
   Kept apart from the registry so lib/ stays free of React. */

import {
  Activity, AlertTriangle, BarChart3, Bot, Building2, CheckCircle, CheckSquare, CloudSun, Cpu,
  Droplets, FileText, HelpCircle, Home, KeyRound, Leaf, Mail, Map, Paperclip, PieChart, Radio,
  Search, Settings, Share2, Shield, ShieldCheck, ShoppingCart, Sprout, Target, TrendingUp, UserCircle,
  Users, Zap, ShoppingBag, Ship, Warehouse, type LucideIcon,
} from 'lucide-react'

const NAV_ICONS: Record<string, LucideIcon> = {
  Activity, AlertTriangle, BarChart3, Bot, Building2, CheckCircle, CheckSquare, CloudSun, Cpu,
  Droplets, FileText, Home, KeyRound, Leaf, Mail, Map, Paperclip, PieChart, Radio, Search, Settings,
  Share2, Shield, ShieldCheck, ShoppingCart, ShoppingBag, Ship, Warehouse, Sprout, Target, TrendingUp, UserCircle, Users, Zap,
  // Lucide has no harvest icon: the sprout stands in.
  Harvest: Sprout,
}

export function navIcon(name: string): LucideIcon {
  return NAV_ICONS[name] ?? HelpCircle
}
