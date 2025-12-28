-- ============================================================================
-- Guest Notification System Migration
-- Created: 2025-12-27
-- Description: Complete notification system for hotel guests
-- ============================================================================

-- ============================================================================
-- Table 1: guest_subscriptions
-- Stores web push notification subscriptions for guests
-- ============================================================================
CREATE TABLE IF NOT EXISTS guest_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_stay_id UUID NOT NULL REFERENCES room_stays(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  subscription_data JSONB NOT NULL, -- Web Push API subscription object
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  last_notified_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  user_agent TEXT, -- Browser information
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for guest_subscriptions
CREATE INDEX idx_guest_subscriptions_room_stay ON guest_subscriptions(room_stay_id);
CREATE INDEX idx_guest_subscriptions_room_number ON guest_subscriptions(room_number);
CREATE INDEX idx_guest_subscriptions_active ON guest_subscriptions(is_active) WHERE is_active = true;

-- ============================================================================
-- Table 2: notification_templates
-- Reusable templates for common notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN (
    'checkout_reminder',
    'service_promo',
    'survey',
    'welcome',
    'custom'
  )),
  icon_url TEXT,
  action_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for notification_templates
CREATE INDEX idx_notification_templates_type ON notification_templates(template_type);
CREATE INDEX idx_notification_templates_active ON notification_templates(is_active) WHERE is_active = true;

-- ============================================================================
-- Table 3: guest_notifications
-- History of all notifications sent to guests
-- ============================================================================
CREATE TABLE IF NOT EXISTS guest_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_subscription_id UUID REFERENCES guest_subscriptions(id) ON DELETE CASCADE,
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
  room_number TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  icon_url TEXT,
  action_url TEXT,
  data JSONB DEFAULT '{}',
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'checkout_reminder',
    'service_promo',
    'survey',
    'welcome',
    'custom'
  )),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered BOOLEAN DEFAULT false,
  opened BOOLEAN DEFAULT false,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for guest_notifications
CREATE INDEX idx_guest_notifications_subscription ON guest_notifications(guest_subscription_id);
CREATE INDEX idx_guest_notifications_room ON guest_notifications(room_number);
CREATE INDEX idx_guest_notifications_type ON guest_notifications(notification_type);
CREATE INDEX idx_guest_notifications_sent ON guest_notifications(sent_at DESC);

-- ============================================================================
-- Table 4: surveys
-- Guest satisfaction surveys
-- ============================================================================
CREATE TABLE IF NOT EXISTS surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL, -- Array of question objects
  is_active BOOLEAN DEFAULT true,
  target_audience TEXT NOT NULL CHECK (target_audience IN (
    'all',
    'checkout',
    'after_stay',
    'specific'
  )),
  created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for surveys
CREATE INDEX idx_surveys_active ON surveys(is_active) WHERE is_active = true;
CREATE INDEX idx_surveys_audience ON surveys(target_audience);

-- ============================================================================
-- Table 5: survey_responses
-- Guest responses to surveys
-- ============================================================================
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  room_stay_id UUID REFERENCES room_stays(id) ON DELETE SET NULL,
  room_number TEXT NOT NULL,
  responses JSONB NOT NULL, -- Structured answers
  guest_feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for survey_responses
CREATE INDEX idx_survey_responses_survey ON survey_responses(survey_id);
CREATE INDEX idx_survey_responses_room ON survey_responses(room_number);
CREATE INDEX idx_survey_responses_submitted ON survey_responses(submitted_at DESC);

-- ============================================================================
-- Row Level Security Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE guest_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- guest_subscriptions policies
-- Allow authenticated users to view subscriptions
CREATE POLICY guest_subscriptions_select_policy ON guest_subscriptions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow anyone to insert subscriptions (for guest self-registration)
CREATE POLICY guest_subscriptions_insert_policy ON guest_subscriptions
  FOR INSERT
  WITH CHECK (true);

-- Only authenticated staff can update subscriptions
CREATE POLICY guest_subscriptions_update_policy ON guest_subscriptions
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Only authenticated staff can delete subscriptions
CREATE POLICY guest_subscriptions_delete_policy ON guest_subscriptions
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- notification_templates policies
-- Only staff can view templates
CREATE POLICY notification_templates_select_policy ON notification_templates
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admin/manager can insert templates
CREATE POLICY notification_templates_insert_policy ON notification_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Only admin/manager can update templates
CREATE POLICY notification_templates_update_policy ON notification_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Only admin/manager can delete templates
CREATE POLICY notification_templates_delete_policy ON notification_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- guest_notifications policies
-- Only authenticated staff can view notification history
CREATE POLICY guest_notifications_select_policy ON guest_notifications
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only authenticated staff can insert notifications
CREATE POLICY guest_notifications_insert_policy ON guest_notifications
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only authenticated staff can update notifications (for delivery status)
CREATE POLICY guest_notifications_update_policy ON guest_notifications
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- surveys policies
-- Anyone can view active surveys
CREATE POLICY surveys_select_policy ON surveys
  FOR SELECT
  USING (is_active = true OR auth.uid() IS NOT NULL);

-- Only admin/manager can insert surveys
CREATE POLICY surveys_insert_policy ON surveys
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Only admin/manager can update surveys
CREATE POLICY surveys_update_policy ON surveys
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Only admin/manager can delete surveys
CREATE POLICY surveys_delete_policy ON surveys
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- survey_responses policies
-- Only staff can view survey responses
CREATE POLICY survey_responses_select_policy ON survey_responses
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Anyone can insert survey responses (guest submission)
CREATE POLICY survey_responses_insert_policy ON survey_responses
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_guest_subscriptions_updated_at
  BEFORE UPDATE ON guest_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_surveys_updated_at
  BEFORE UPDATE ON surveys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Seed Data: Default Templates
-- ============================================================================

INSERT INTO notification_templates (name, title_template, body_template, template_type, icon_url) VALUES
(
  'Bienvenida',
  '¡Bienvenido a nuestro hotel! 🏨',
  'Habitación {room_number}: Esperamos que disfrute su estancia. Estamos a su servicio las 24 horas.',
  'welcome',
  '/icons/welcome.png'
),
(
  'Recordatorio de Salida',
  'Recordatorio: Check-out a las {checkout_time} ⏰',
  'Estimado huésped de la habitación {room_number}, su check-out está programado para las {checkout_time}. Por favor, asegúrese de estar listo.',
  'checkout_reminder',
  '/icons/checkout.png'
),
(
  'Promoción Restaurante',
  'Disfruta de nuestro restaurante 🍽️',
  'Tenemos un menú especial hoy. Horario: 7am - 10pm. ¡Te esperamos!',
  'service_promo',
  '/icons/restaurant.png'
),
(
  'Encuesta de Satisfacción',
  '¿Cómo fue tu experiencia? ⭐',
  'Nos encantaría conocer tu opinión. Tu feedback nos ayuda a mejorar.',
  'survey',
  '/icons/survey.png'
);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE guest_subscriptions IS 'Web push notification subscriptions for hotel guests';
COMMENT ON TABLE notification_templates IS 'Reusable templates for guest notifications';
COMMENT ON TABLE guest_notifications IS 'History of all notifications sent to guests';
COMMENT ON TABLE surveys IS 'Guest satisfaction surveys';
COMMENT ON TABLE survey_responses IS 'Guest responses to surveys';
