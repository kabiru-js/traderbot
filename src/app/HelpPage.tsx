import { LifeBuoy, Mail, MessageSquare, BookOpen, ShieldCheck } from 'lucide-react'
import { Card, PageTitle } from './ui'

export default function HelpPage() {
  const items = [
    { icon: <BookOpen size={18} />, title: 'Getting Started', desc: 'Create an account, deposit funds, and launch your first AI strategy in minutes.', tone: '#0EA5E9' },
    { icon: <ShieldCheck size={18} />, title: 'Security', desc: 'Enable two-factor authentication and keep your exchange API keys private — they are encrypted at rest.', tone: '#10B981' },
    { icon: <MessageSquare size={18} />, title: 'AI Intelligence', desc: 'Understand your risk score, asset signals, and recommendations — the AI is an analyst, not a chatbot.', tone: '#8B5CF6' },
    { icon: <Mail size={18} />, title: 'Contact Support', desc: 'Reach us at hello@nexora.ai — we reply within 24 hours on business days.', tone: '#F59E0B' },
  ]
  return (
    <div>
      <PageTitle
        title={
          <>
            <span className="gradient-text">Help</span> & Support
          </>
        }
        sub="Guides, security tips, and how to reach us."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="hero-grid">
        {items.map((i) => (
          <Card key={i.title} style={{ display: 'flex', gap: 14 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                flexShrink: 0,
                background: `${i.tone}1a`,
                border: `1px solid ${i.tone}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: i.tone,
              }}
            >
              {i.icon}
            </div>
            <div>
              <p style={{ color: '#F0F4FF', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{i.title}</p>
              <p style={{ color: '#64748B', fontSize: 13, lineHeight: 1.6 }}>{i.desc}</p>
            </div>
          </Card>
        ))}
      </div>
      <Card style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <LifeBuoy size={18} style={{ color: '#0EA5E9' }} />
        <p style={{ color: '#94A3B8', fontSize: 13 }}>
          Still stuck? Email <span style={{ color: '#0EA5E9', fontWeight: 600 }}>hello@nexora.ai</span> or use the in-app chat (coming soon).
        </p>
      </Card>
    </div>
  )
}
