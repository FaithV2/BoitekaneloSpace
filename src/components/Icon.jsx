import {
  ArrowRight,
  BriefcaseMedical,
  ChartNoAxesCombined,
  Frown,
  Heart,
  House,
  LockKeyhole,
  Meh,
  Menu,
  MessageCircle,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Smile,
  Sparkles,
  UserRound,
  X,
  Zap
} from 'lucide-react'

const iconMap = {
  home: House,
  feed: MessageCircle,
  heart: Heart,
  therapist: BriefcaseMedical,
  mood: ChartNoAxesCombined,
  checkin: Sparkles,
  profile: UserRound,
  admin: ShieldCheck,
  arrow: ArrowRight,
  plus: Plus,
  message: MessageCircle,
  happy: Smile,
  calm: Meh,
  anxious: ShieldAlert,
  sad: Frown,
  stressed: Zap,
  shield: ShieldCheck,
  lock: LockKeyhole,
  menu: Menu,
  close: X
}

export default function Icon({ name, size = 18, strokeWidth = 1.8, ...props }) {
  const IconComponent = iconMap[name] ?? Plus

  return (
    <IconComponent aria-hidden="true" size={size} strokeWidth={strokeWidth} focusable="false" {...props} />
  )
}
