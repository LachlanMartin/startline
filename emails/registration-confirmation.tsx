import { Section, Text } from '@react-email/components'
import { Shell } from './components/shell'
import { EmailHeader } from './components/email-header'
import { EmailFooter } from './components/email-footer'
import { Badge } from './components/badge'
import { Headline } from './components/headline'
import { CtaButton } from './components/cta-button'
import { colors, fonts, SITE_URL } from './components/tokens'

export interface RegistrationConfirmationEmailProps {
  eventName: string
  eventSeries?: string
  eventDate: string
  startTime: string
  category: string
  location: string
  bib?: string
  registrationFee: string
  serviceFee: string
  total: string
  /** Merchandise bought with the entry. Omitted entirely when there is none. */
  addOns?: { label: string; amount: string }[]
  userEmail: string
}

const labelStyle: React.CSSProperties = {
  margin: '0 0 4px',
  fontFamily: "'Chakra Petch', Arial, sans-serif",
  fontSize: '10px',
  fontWeight: '700',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: '#8A8F98',
}

const valueStyle: React.CSSProperties = {
  margin: '0',
  fontFamily: "'Chakra Petch', Arial, sans-serif",
  fontSize: '15px',
  fontWeight: '700',
  color: '#F5F7FA',
}

export function RegistrationConfirmationEmail({
  eventName,
  eventSeries,
  eventDate,
  startTime,
  category,
  location,
  bib,
  registrationFee,
  serviceFee,
  total,
  addOns = [],
  userEmail,
}: RegistrationConfirmationEmailProps) {
  return (
    <Shell preview={`You're registered for ${eventName}`}>
      <EmailHeader />

      {/* Hero band */}
      <Section
        style={{
          backgroundColor: 'rgba(179,225,83,0.04)',
          padding: '36px 44px',
          borderBottom: `1px solid ${colors.border}`,
          textAlign: 'center',
        }}
      >
        <Badge type="success" />
        <Headline line1="You're In." />
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: '15px',
            color: colors.muted,
            lineHeight: '1.65',
            margin: '0',
          }}
        >
          Your registration is confirmed. See you on race day.
        </Text>
      </Section>

      {/* Event card */}
      <Section style={{ padding: '32px 44px 0' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
          }}
        >
          <tbody>
            {/* Header */}
            <tr>
              <td
                style={{
                  backgroundColor: colors.row,
                  padding: '18px 22px',
                  borderRadius: '12px 12px 0 0',
                }}
                colSpan={3}
              >
                <p
                  style={{
                    margin: '0 0 4px',
                    fontFamily: fonts.heading,
                    fontSize: '19px',
                    fontWeight: '700',
                    fontStyle: 'italic',
                    color: colors.text,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {eventName}
                </p>
                {eventSeries && (
                  <p
                    style={{
                      margin: '0',
                      fontFamily: fonts.body,
                      fontSize: '13px',
                      color: colors.muted,
                    }}
                  >
                    {eventSeries}
                  </p>
                )}
              </td>
            </tr>

            {/* 3-column meta row */}
            <tr>
              <td
                style={{
                  padding: '14px 22px',
                  borderTop: `1px solid ${colors.border}`,
                  borderRight: `1px solid ${colors.border}`,
                  width: '33.33%',
                }}
              >
                <p style={labelStyle}>Date</p>
                <p style={valueStyle}>{eventDate}</p>
              </td>
              <td
                style={{
                  padding: '14px 22px',
                  borderTop: `1px solid ${colors.border}`,
                  borderRight: `1px solid ${colors.border}`,
                  width: '33.33%',
                }}
              >
                <p style={labelStyle}>Start Time</p>
                <p style={valueStyle}>{startTime}</p>
              </td>
              <td
                style={{
                  padding: '14px 22px',
                  borderTop: `1px solid ${colors.border}`,
                  width: '33.33%',
                }}
              >
                <p style={labelStyle}>Category</p>
                <p style={valueStyle}>{category}</p>
              </td>
            </tr>

            {/* Location row */}
            <tr>
              <td
                style={{
                  padding: '14px 22px',
                  borderTop: `1px solid ${colors.border}`,
                }}
                colSpan={3}
              >
                <p style={labelStyle}>Location</p>
                <p style={valueStyle}>{location}</p>
              </td>
            </tr>

            {/* Bib row */}
            {bib && (
              <tr>
                <td
                  style={{
                    padding: '14px 22px',
                    borderTop: `1px solid ${colors.border}`,
                    backgroundColor: 'rgba(179,225,83,0.06)',
                    textAlign: 'center',
                  }}
                  colSpan={3}
                >
                  <p style={{ ...labelStyle, color: colors.muted }}>Bib Number</p>
                  <p
                    style={{
                      margin: '0',
                      fontFamily: fonts.heading,
                      fontSize: '26px',
                      fontWeight: '700',
                      fontStyle: 'italic',
                      color: colors.primary,
                    }}
                  >
                    #{bib}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      {/* Order summary */}
      <Section style={{ padding: '20px 44px 0' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
          }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  padding: '13px 22px',
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td>
                        <p
                          style={{
                            margin: '0',
                            fontFamily: fonts.body,
                            fontSize: '14px',
                            color: colors.text,
                          }}
                        >
                          Registration
                        </p>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <p
                          style={{
                            margin: '0',
                            fontFamily: fonts.body,
                            fontSize: '14px',
                            color: colors.text,
                          }}
                        >
                          {registrationFee}
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            {addOns.map((addOn) => (
              <tr key={addOn.label}>
                <td
                  style={{
                    padding: '13px 22px',
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td>
                          <p
                            style={{
                              margin: '0',
                              fontFamily: fonts.body,
                              fontSize: '14px',
                              color: colors.text,
                            }}
                          >
                            {addOn.label}
                          </p>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <p
                            style={{
                              margin: '0',
                              fontFamily: fonts.body,
                              fontSize: '14px',
                              color: colors.text,
                            }}
                          >
                            {addOn.amount}
                          </p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            ))}
            <tr>
              <td
                style={{
                  padding: '13px 22px',
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td>
                        <p
                          style={{
                            margin: '0',
                            fontFamily: fonts.body,
                            fontSize: '13px',
                            color: colors.muted,
                          }}
                        >
                          Service fee
                        </p>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <p
                          style={{
                            margin: '0',
                            fontFamily: fonts.body,
                            fontSize: '13px',
                            color: colors.muted,
                          }}
                        >
                          {serviceFee}
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td
                style={{
                  padding: '13px 22px',
                  backgroundColor: colors.row,
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td>
                        <p
                          style={{
                            margin: '0',
                            fontFamily: fonts.heading,
                            fontSize: '11px',
                            fontWeight: '700',
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            color: colors.muted,
                          }}
                        >
                          Total
                        </p>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <p
                          style={{
                            margin: '0',
                            fontFamily: fonts.heading,
                            fontSize: '22px',
                            fontWeight: '700',
                            fontStyle: 'italic',
                            color: colors.text,
                          }}
                        >
                          {total}
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* CTA */}
      <Section style={{ padding: '24px 44px 40px', textAlign: 'center' }}>
        <CtaButton href={`${SITE_URL}/events`} label="View Event Details" />
        <Text
          style={{
            margin: '16px 0 0',
            fontFamily: fonts.body,
            fontSize: '12px',
            color: colors.muted,
          }}
        >
          A confirmation has been sent to <strong>{userEmail}</strong>
        </Text>
      </Section>

      <EmailFooter />
    </Shell>
  )
}

export default RegistrationConfirmationEmail
