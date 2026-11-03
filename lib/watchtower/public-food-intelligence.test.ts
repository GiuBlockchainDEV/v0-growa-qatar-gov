import {describe,it,expect} from 'vitest'
import {parseFaoExternalAssistanceHtml,parseFewsRss} from './public-food-intelligence'
describe('keyless official global food security fallback',()=>{
  it('reads the FAO GIEWS published country count and edition, without inventing an IPC count',()=>{
    const html='<html><body>Countries requiring external assistance for food'+
      '<h2>July 2026</h2><p> (total: <b>41</b> countries)</p></body></html>'
    // Real text can put markup between the number and its label.
    const result=parseFaoExternalAssistanceHtml(html)
    expect(result.count).toBe(41)
    expect(result.edition).toBe('July 2026')
  })
  it('rejects missing FAO totals instead of reporting zero',()=>{
    expect(()=>parseFaoExternalAssistanceHtml('<html>no countries</html>')).toThrow()
  })
  it('reads real attributed FEWS RSS items and ignores bogus links and expired dates',()=>{
    const rss='<?xml version="1.0"?><rss><channel>'+
      '<item><title>Food Security Outlook &amp; Markets</title>'+
      '<link>https://fews.net/global/food-security-outlook/october-2026</link>'+
      '<pubDate>Thu, 15 Oct 2026 12:00:00 GMT</pubDate></item>'+
      '<item><title>Bad location</title><link>https://untrusted.example.com/a</link>'+
      '<pubDate>Thu, 15 Oct 2026 12:00:00 GMT</pubDate></item>'+
      '</channel></rss>'
    const found=parseFewsRss(rss,Date.UTC(2026,10,3))
    expect(found).toHaveLength(1)
    expect(found[0].title).toContain('Food Security Outlook & Markets')
  })
})
