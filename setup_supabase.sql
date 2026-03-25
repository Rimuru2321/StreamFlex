-- StreamFlex Supabase Setup Script
-- Run this in Supabase SQL Editor

-- 1. Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    email TEXT,
    favorites JSONB DEFAULT '[]'::jsonb,
    watch_later JSONB DEFAULT '[]'::jsonb,
    watch_history JSONB DEFAULT '[]'::jsonb,
    top10_list JSONB DEFAULT '[]'::jsonb,
    user_ratings JSONB DEFAULT '{}'::jsonb,
    user_notes JSONB DEFAULT '{}'::jsonb,
    custom_lists JSONB DEFAULT '{}'::jsonb,
    achievements JSONB DEFAULT '{}'::jsonb,
    streak_data JSONB DEFAULT '{"streak":0,"longest":0,"lastWatch":null}'::jsonb,
    marathon_queue JSONB DEFAULT '[]'::jsonb,
    avatar_icon TEXT,
    is_premium BOOLEAN DEFAULT false,
    friends JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    is_premium BOOLEAN DEFAULT false,
    avatar_icon TEXT,
    watched INTEGER DEFAULT 0,
    xp INTEGER DEFAULT 0,
    level TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    media_type TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT,
    user_avatar_icon TEXT,
    text TEXT,
    rating INTEGER,
    is_premium BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create friend_requests table
CREATE TABLE IF NOT EXISTS friend_requests (
    id TEXT PRIMARY KEY,
    from_uid UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    to_uid UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    from_name TEXT,
    from_avatar_icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create codes table for premium codes
CREATE TABLE IF NOT EXISTS codes (
    code TEXT PRIMARY KEY,
    used BOOLEAN DEFAULT false,
    used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ
);

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for leaderboard
CREATE POLICY "Anyone can view leaderboard" ON leaderboard FOR SELECT USING (true);
CREATE POLICY "Users can update own leaderboard entry" ON leaderboard FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own leaderboard entry" ON leaderboard FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for reviews
CREATE POLICY "Anyone can view reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Users can insert own reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON reviews FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for friend_requests
CREATE POLICY "Anyone can view friend requests" ON friend_requests FOR SELECT USING (true);
CREATE POLICY "Users can insert friend requests" ON friend_requests FOR INSERT WITH CHECK (auth.uid() = from_uid);
CREATE POLICY "Users can update own friend requests" ON friend_requests FOR UPDATE USING (auth.uid() = from_uid OR auth.uid() = to_uid);
CREATE POLICY "Users can delete own friend requests" ON friend_requests FOR DELETE USING (auth.uid() = from_uid OR auth.uid() = to_uid);

-- RLS Policies for codes
CREATE POLICY "Anyone can view codes" ON codes FOR SELECT USING (true);
CREATE POLICY "Users can update codes" ON codes FOR UPDATE USING (true);

-- Enable Realtime for leaderboard
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_reviews_item_id ON reviews(item_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to_uid ON friend_requests(to_uid);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from_uid ON friend_requests(from_uid);
CREATE INDEX IF NOT EXISTS idx_leaderboard_xp ON leaderboard(xp DESC);

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
        NOW(),
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-creating profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert some sample premium codes (for testing)
INSERT INTO codes (code, used) VALUES 
    ('PREMIUM2024', false),
    ('STREAMFLEX', false),
    ('TESTCODE', false)
ON CONFLICT (code) DO NOTHING;
