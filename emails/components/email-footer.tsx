import { Section, Text, Link } from '@react-email/components'
import { colors, fonts } from './tokens'

const socialStyle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontSize: '10px',
  fontWeight: '700',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color: colors.faint,
  textDecoration: 'none',
}

const divStyle: React.CSSProperties = {
  color: colors.faint,
  margin: '0 6px',
}

export function EmailFooter() {
  return (
    <Section
      style={{
        borderTop: `1px solid ${colors.border}`,
        padding: '28px 44px 26px',
        textAlign: 'center',
      }}
    >
      <Text style={{ margin: '0 0 10px', fontSize: '10px' }}>
        <Link href="https://www.instagram.com/startlineau" style={socialStyle}>Instagram</Link>
        <span style={divStyle}>|</span>
        <Link href="https://www.facebook.com/startlineau" style={socialStyle}>Facebook</Link>
        <span style={divStyle}>|</span>
        <Link href="https://www.strava.com/clubs/startlineau" style={socialStyle}>Strava</Link>
      </Text>

      <Text style={{ margin: '0 0 6px', fontFamily: fonts.body, fontSize: '12px', color: colors.muted }}>
        Didn&apos;t get this email? Check your spam or junk folder.
      </Text>

      <Text style={{ margin: '0 0 6px', fontFamily: fonts.body, fontSize: '12px', color: colors.muted }}>
        Need help?{' '}
        <Link href="mailto:support@startline.com.au" style={{ color: colors.muted }}>
          support@startline.com.au
        </Link>
      </Text>

      <Text style={{ margin: '0 0 16px', fontFamily: fonts.body, fontSize: '11px', color: colors.faint }}>
        <Link href="#" style={{ color: colors.faint, textDecoration: 'none' }}>Unsubscribe</Link>
        {' · '}
        <Link href="#" style={{ color: colors.faint, textDecoration: 'none' }}>Manage Preferences</Link>
      </Text>

      <Text style={{ margin: '0', fontFamily: fonts.body, fontSize: '11px', color: colors.faint, lineHeight: '1.7' }}>
        © 2026 Startline Pty Ltd · ABN 12 345 678 901<br />
        PO Box 1234, Sydney NSW 2000, Australia
      </Text>
      <Text style={{ margin: '4px 0 0', fontFamily: fonts.body, fontSize: '10px', color: colors.faint }}>
        This is a transactional email. You cannot unsubscribe from account and event notifications.
      </Text>
    </Section>
  )
}
