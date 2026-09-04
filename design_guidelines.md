# The GTW - Design Guidelines

## Architecture Decisions

### Authentication
**Auth Required** - The app involves:
- Multi-user interaction (senders and carriers)
- Trust and safety requirements for parcel handoffs
- Compensation/payment tracking
- User ratings and history

**Implementation:**
- SSO preferred: Apple Sign-In (iOS) and Google Sign-In (Android/cross-platform)
- Mock auth flow in prototype using local state
- Login/signup screens with privacy policy & terms of service placeholder links
- Account screen includes:
  - User profile with avatar, display name, phone number (required for coordination)
  - Verification badge display
  - Rating/review history
  - Log out (with confirmation)
  - Delete account (Settings > Account > Delete with double confirmation)

### Navigation Architecture
**Tab Navigation** (4 tabs + floating action button)

**Information Architecture:**
1. **Browse Tab** (Home) - Search and filter parcels by route
2. **My Parcels Tab** - View created and accepted parcels
3. **Messages Tab** - Coordinate with other users
4. **Profile Tab** - Account, settings, payment info

**Floating Action Button** - Create new parcel (positioned bottom-right, elevated above tab bar)

**Navigation Stacks:**
- Browse Stack: Browse > Parcel Detail > User Profile
- My Parcels Stack: My Parcels > Parcel Detail > Edit Parcel
- Messages Stack: Message List > Conversation
- Profile Stack: Profile > Settings > Edit Profile

**Modal Screens:**
- Create Parcel (full-screen modal with custom header)
- Route Filter (bottom sheet modal)
- Accept Parcel Confirmation (alert/modal)

## Screen Specifications

### 1. Browse Screen (Home Tab)
**Purpose:** Search and browse available parcels by route

**Layout:**
- Header: Custom transparent header
  - Left: App logo/title "The GTW"
  - Right: Filter icon button
  - Search bar below title with route input (From → To)
- Main content: Scrollable list with pull-to-refresh
- Floating elements: Create parcel FAB (bottom-right)
- Safe area insets: 
  - Top: headerHeight + Spacing.xl
  - Bottom: tabBarHeight + Spacing.xl + 72px (FAB clearance)

**Components:**
- Route search input (origin and destination autocomplete)
- Parcel cards showing: origin, destination, size category, compensation, pickup date
- Quick filters (Today, This Week, Price Range)
- Empty state for no results

### 2. Parcel Detail Screen
**Purpose:** View full parcel information and accept/coordinate delivery

**Layout:**
- Header: Default navigation header (non-transparent)
  - Left: Back button
  - Right: Share/Report buttons
- Main content: Scrollable view
- Safe area insets:
  - Top: Spacing.xl
  - Bottom: insets.bottom + 120px (action button clearance)

**Components:**
- Route map visualization (simple line with stops)
- Parcel information cards: Size, weight, description, photos
- Compensation/price prominently displayed
- Pickup and delivery time windows
- Sender profile card (avatar, name, rating)
- Accept/Offer to Transport button (fixed at bottom)

### 3. Create Parcel Screen (Modal)
**Purpose:** Quick parcel creation with essential details

**Layout:**
- Header: Custom header (non-transparent)
  - Left: Cancel button
  - Right: Next button (initially disabled)
  - Title: "Create Parcel"
- Main content: Scrollable form
- Safe area insets:
  - Top: Spacing.xl
  - Bottom: insets.bottom + Spacing.xl

**Form Fields (Step 1 - Required):**
1. Origin location (autocomplete)
2. Destination location (autocomplete)
3. Size category (Small, Medium, Large icons)
4. Pickup date/time

**Post-Creation Flow:**
- After "Next," navigate to Edit Parcel screen to add optional details
- Success toast: "Parcel created! Add more details?"

### 4. Edit Parcel Screen
**Purpose:** Add detailed information after initial creation

**Layout:**
- Header: Default navigation header
  - Left: Back button
  - Right: Save button
- Main content: Scrollable form
- Safe area insets:
  - Top: Spacing.xl
  - Bottom: insets.bottom + Spacing.xl

**Additional Fields:**
- Weight (input + unit selector)
- Description (text area)
- Photos (up to 4)
- Compensation amount
- Special instructions
- Fragile/handling requirements toggles

### 5. My Parcels Screen
**Purpose:** Manage created and accepted parcels

**Layout:**
- Header: Default navigation header
  - Title: "My Parcels"
  - Segmented control: Created | Transporting
- Main content: List
- Safe area insets:
  - Top: Spacing.xl
  - Bottom: tabBarHeight + Spacing.xl

**Components:**
- Parcel cards with status badges (Pending, In Transit, Delivered)
- Swipe actions: Edit (created), Contact (transporting)

### 6. Profile Screen
**Purpose:** User account and app settings

**Layout:**
- Header: Custom transparent header
  - Right: Settings icon
- Main content: Scrollable
- Safe area insets:
  - Top: headerHeight + Spacing.xl
  - Bottom: tabBarHeight + Spacing.xl

**Components:**
- User avatar (large, centered)
- Display name and rating
- Statistics cards (Parcels sent, Parcels delivered, Rating)
- Payment methods section
- Quick actions: Edit Profile, Transaction History

## Design System

### Color Palette
- **Primary:** Deep teal (#0A7EA4) - trust, reliability
- **Secondary:** Warm orange (#F97316) - action, energy
- **Success:** #10B981
- **Warning:** #F59E0B
- **Error:** #EF4444
- **Background:** #FFFFFF (light mode), #1A1A1A (dark mode)
- **Surface:** #F9FAFB (light mode), #2A2A2A (dark mode)
- **Text Primary:** #111827 (light mode), #F9FAFB (dark mode)
- **Text Secondary:** #6B7280 (light mode), #9CA3AF (dark mode)

### Typography
- **Headings:** SF Pro Display (iOS), Roboto (Android)
  - H1: 28px, Bold
  - H2: 22px, Semibold
  - H3: 18px, Semibold
- **Body:** SF Pro Text (iOS), Roboto (Android)
  - Body: 16px, Regular
  - Small: 14px, Regular
  - Caption: 12px, Regular

### Visual Design
- **Icons:** Feather icons from @expo/vector-icons
  - Navigation: map-pin, package, message-circle, user
  - Actions: plus-circle, filter, share-2, more-horizontal
- **Cards:** 
  - Border radius: 12px
  - Elevation: 2dp (Android), shadow for iOS
  - Padding: 16px
  - Background: Surface color
- **Floating Action Button:**
  - Size: 56x56px
  - Border radius: 28px
  - Background: Primary color
  - Icon: plus (white)
  - Shadow: shadowOffset {width: 0, height: 2}, shadowOpacity: 0.10, shadowRadius: 2
  - Position: bottom-right, 16px from edges
- **Input Fields:**
  - Height: 48px
  - Border radius: 8px
  - Border: 1px, #E5E7EB
  - Focus state: Primary color border
- **Buttons:**
  - Primary: Full width, 48px height, Primary color, white text
  - Secondary: Outlined, Primary color border and text
  - Pressed state: 10% opacity reduction

### Critical Assets
1. **App Logo** - Clean, minimal mark representing route/connection (generated)
2. **Default User Avatars** - 6 geometric avatars in brand colors (generated)
3. **Size Category Icons** - Small box, medium box, large box illustrations (generated)
4. **Empty State Illustrations:**
   - No parcels found (search/magnifying glass)
   - No messages yet (message bubble)
5. **Onboarding Illustrations** - 3 screens explaining how GTW works (generated)

### Accessibility
- Minimum touch target: 44x44px
- Color contrast ratio: 4.5:1 for text
- Support for dynamic type sizing
- VoiceOver/TalkBack labels for all interactive elements
- Haptic feedback for critical actions (accept parcel, create parcel)