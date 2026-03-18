# Meta Ads Setup for Helm Media Campaigns

## Overview

Meta's Marketing API allows programmatic creation and management of Facebook/Instagram ad campaigns. This document explains what's needed to automate the paid media flow end-to-end.

## Current MVP Approach

For MVP, campaigns are submitted to the Good Morning Music team at **rp@goodmornmusic.com** who run the ads manually. This lets us validate the product before investing in Meta API integration.

Flow:
1. Artist uploads creative assets (flyer, artwork, audio) via the Helm dashboard
2. Assets + details are emailed to rp@goodmornmusic.com
3. Team creates and manages the campaign manually in Meta Ads Manager
4. Artist pays via Stripe Checkout

---

## Future: Automate via Meta Marketing API

### What You Need

1. **Facebook App** with Marketing API access
   - Create at https://developers.facebook.com/apps
   - Request `ads_management` and `ads_read` permissions
   - Submit for App Review to get production access

2. **User Ad Account Connection (OAuth)**
   - Artist connects their Facebook Ad Account to Helm
   - OAuth scopes needed: `ads_management`, `business_management`
   - Store the user's access token (short-lived, refresh via long-lived token exchange)

3. **Business Manager**
   - Helm needs a Meta Business Manager account
   - Artists grant Helm access to their Ad Account via Business Manager

### The Programmatic Campaign Flow

```
1. User connects FB Ad Account via OAuth
   POST https://graph.facebook.com/oauth/access_token
   → Store access_token, ad_account_id

2. Create Campaign
   POST https://graph.facebook.com/v19.0/act_{ad_account_id}/campaigns
   {
     name: "Helm — {release name}",
     objective: "OUTCOME_AWARENESS",  // or OUTCOME_TRAFFIC, OUTCOME_ENGAGEMENT
     status: "PAUSED",
     special_ad_categories: []
   }
   → Returns campaign_id

3. Create Ad Set (targeting + budget)
   POST https://graph.facebook.com/v19.0/act_{ad_account_id}/adsets
   {
     name: "Helm Ad Set",
     campaign_id: campaign_id,
     daily_budget: daily_spend_cents,  // in cents
     billing_event: "IMPRESSIONS",
     optimization_goal: "REACH",
     targeting: {
       age_min: 18,
       age_max: 35,
       interests: [{ id: "6003139266461", name: "Music" }],
       geo_locations: { countries: ["US"] }
     },
     start_time: "2024-01-01T00:00:00+0000",
     end_time: "2024-01-08T00:00:00+0000",
     status: "PAUSED"
   }
   → Returns adset_id

4. Upload Ad Creative (composite video or image)
   POST https://graph.facebook.com/v19.0/act_{ad_account_id}/advideos
   (multipart upload for video)
   — or —
   POST https://graph.facebook.com/v19.0/act_{ad_account_id}/adimages
   (for static image ads)
   → Returns creative_id / image_hash

5. Create Ad Creative object
   POST https://graph.facebook.com/v19.0/act_{ad_account_id}/adcreatives
   {
     name: "Helm Creative",
     object_story_spec: {
       page_id: artist_fb_page_id,
       video_data: {
         video_id: video_id,
         title: "Check out my new release",
         call_to_action: { type: "LISTEN_NOW", value: { link: spotify_url } }
       }
     }
   }
   → Returns adcreative_id

6. Create Ad
   POST https://graph.facebook.com/v19.0/act_{ad_account_id}/ads
   {
     name: "Helm Ad",
     adset_id: adset_id,
     creative: { creative_id: adcreative_id },
     status: "ACTIVE"
   }
   → Campaign is live!
```

### Video Creative Production

For the audio+artwork composite video ad:
- Use **ffmpeg** to overlay audio on a looping artwork image
  ```bash
  ffmpeg -loop 1 -i artwork.jpg -i audio.mp3 -c:v libx264 -tune stillimage \
    -c:a aac -b:a 192k -pix_fmt yuv420p -shortest output.mp4
  ```
- Or use **Cloudinary** Video API for cloud-based compositing:
  - Upload artwork to Cloudinary
  - Use video transformation: `l_audio:audio_file_id,fl_layer_apply`
  - Returns a CDN URL for the composite video

### API Reference Links

- Marketing API Getting Started: https://developers.facebook.com/docs/marketing-apis/get-started
- Ad Campaign Create: https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group
- Ad Set Create: https://developers.facebook.com/docs/marketing-api/reference/ad-campaign
- Ad Creative Create: https://developers.facebook.com/docs/marketing-api/reference/ad-creative
- Targeting Specs: https://developers.facebook.com/docs/marketing-api/audiences/reference/basic-targeting

### Environment Variables Needed (Future)

```env
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_SYSTEM_USER_TOKEN=your_system_user_token  # for server-side calls
```

### Key Considerations

- **Ad Account ownership**: The artist must own or admin the Ad Account used for billing
- **Page requirement**: Instagram/Facebook ads require a linked Facebook Page
- **Review time**: New ad accounts and creatives go through a ~24h review before going live
- **Spend limits**: New ad accounts have daily spend limits (~$50/day) that increase over time
- **Targeting restrictions**: Music-related ads may be restricted in some regions
