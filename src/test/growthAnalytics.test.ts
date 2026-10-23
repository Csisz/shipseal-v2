import { beforeEach, describe, expect, it } from 'vitest';
import { filterAnalyticsPageview, firstTouchCampaignAttribution } from '@/lib/growthAnalytics';

describe('Growth Analytics privacy boundaries', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('keeps only allowlisted first-touch campaign dimensions for the browser session', () => {
    const first = firstTouchCampaignAttribution('?utm_source=LinkedIn&utm_medium=paid-social&utm_campaign=launch-sprint-01&token=secret');
    const second = firstTouchCampaignAttribution('?utm_source=google&utm_medium=cpc&utm_campaign=product_launch');

    expect(first).toEqual({ utmSource: 'linkedin', utmMedium: 'paid_social', utmCampaign: 'launch_sprint_01' });
    expect(second).toEqual(first);
    expect(window.sessionStorage).toHaveLength(1);
    expect(window.sessionStorage.getItem('shipseal.analytics.attribution.v1')).not.toMatch(/token|secret|google|cpc|product_launch/);
  });

  it('maps arbitrary UTM values to other instead of retaining user-controlled text', () => {
    const attribution = firstTouchCampaignAttribution('?utm_source=customer@example.com&utm_medium=private-note&utm_campaign=repo-secret');

    expect(attribution).toEqual({ utmSource: 'other', utmMedium: 'other', utmCampaign: 'other' });
    expect(JSON.stringify(attribution)).not.toMatch(/customer|private|repo-secret|@/);
  });

  it('does not create attribution or a visitor identifier without supported UTM parameters', () => {
    expect(firstTouchCampaignAttribution('?projectId=prj_private&ref=arbitrary')).toBeNull();
    expect(window.sessionStorage).toHaveLength(0);
  });

  it('removes query strings and fragments from approved pageviews', () => {
    const filtered = filterAnalyticsPageview({ type: 'pageview', url: 'https://www.getshipseal.com/?utm_source=github#scan' });

    expect(filtered).toEqual({ type: 'pageview', url: 'https://www.getshipseal.com/' });
  });

  it('replaces private project and scan identifiers with route placeholders', () => {
    const filtered = filterAnalyticsPageview({
      type: 'pageview',
      url: 'https://www.getshipseal.com/projects/prj_PRIVATE/scans/scn_PRIVATE?open=futures',
    });

    expect(filtered).toEqual({
      type: 'pageview',
      url: 'https://www.getshipseal.com/projects/:projectId/scans/:scanId',
    });
  });

  it('suppresses sensitive routes and collapses arbitrary paths', () => {
    expect(filterAnalyticsPageview({ type: 'pageview', url: 'https://www.getshipseal.com/account/complete?code=oauth-secret' })).toBeNull();
    expect(filterAnalyticsPageview({ type: 'pageview', url: 'https://www.getshipseal.com/payment/success?session_id=secret' })).toBeNull();
    expect(filterAnalyticsPageview({ type: 'pageview', url: 'https://www.getshipseal.com/admin' })).toBeNull();
    expect(filterAnalyticsPageview({ type: 'pageview', url: 'https://www.getshipseal.com/private/customer/token' }))
      .toEqual({ type: 'pageview', url: 'https://www.getshipseal.com/not-found' });
  });
});
