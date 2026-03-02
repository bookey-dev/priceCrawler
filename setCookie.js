// 设置新的Cookie脚本
import cookieManager from './server/cookieManager.cjs';

// 用户提供的Cookie字符串
const newCookie = 'OptanonAlertBoxClosed=2025-12-17T05:31:26.730Z; _gcl_au=1.1.753703508.1765949487; customerLastViewed=%5B%2214885%22%5D; customerCookie=1; _hjSessionUser_3827276=eyJpZCI6IjNhNzA0ZTQ5LThjYjMtNWIzYS1hZGMzLTI2ODdlMjA0M2M2NCIsImNyZWF0ZWQiOjE3NjU5NDk0OTI5NzQsImV4aXN0aW5nIjp0cnVlfQ==; nevejewels-_zldp=flQwlMpDTx7JBi8dJJ%2BzIOmuJTmD4RgTUHkiGqsCrOOYd6%2BxDHf2m3wMf%2FERYC%2BR2qq42%2B9BycU%3D; nevejewels-_zldt=630907ab-3a6c-4ce7-8b1d-e445cd8cd85d-1; __kla_id=eyJjaWQiOiJORGN3TTJabE1tTXRZelJoTlMwMFlUZ3hMV0ZoTWpRdE5XTXpZV1V4TXpkbFptUmkifQ==; OCSESSID=e76fdc856ba53131e00787f2d1; _gid=GA1.2.350800844.1769046257; _hjSession_3827276=eyJpZCI6ImJkYTM3ZTg4LWQ0MDUtNGM1MC1hNjEzLWNmZDFlNTJlM2RiNyIsImMiOjE3NjkwNjM0ODA5MDYsInMiOjEsInIiOjEsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjowLCJzcCI6MH0=; __cf_bm=B9xgcRo7lvd6KDMbkWPB6U4PHsg4kTWef4Gtk6EwaUw-1769066759-1.0.1.1-RhJghSMUWYyXBjQLY1Ug6V8QhwZEzH3y1OthjQaXPsotU0R_T3HCSr7892JX_XudYPBziZZ168ZupmDqf87IayKQqxvq4QyHBLo785Ab1zg; _dc_gtm_UA-5217843-11=1; _ga=GA1.1.1198124581.1765949471; OptanonConsent=isGpcEnabled=0&datestamp=Thu+Jan+22+2026+15%3A26%3A49+GMT%2B0800+(%E4%B8%AD%E5%9B%BD%E6%A0%87%E5%87%86%E6%97%B6%E9%97%B4)&version=202512.1.0&browserGpcFlag=0&isIABGlobal=false&hosts=&consentId=7ebbb751-ad58-492a-9f5b-b8336e914974&interactionCount=1&isAnonUser=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1&intType=1&geolocation=HK%3B&AwaitingReconsent=false; cf_clearance=opt0boRWRvEVpk7GGGmBhMd1s86gIj1lIUHCoGssYEY-1769066810-1.2.1.1-7GBfRBKqW_yr3CdpXUAWXOJOx9czrVTxb2LCBUC858wSglyD94RbNy50sYmaM6HkVE4HmcJ6hKgy_CJ03WBC0FJVLN7e44hWzAt_bSSjBb.G5CW4qXTgANckirTZ8ukt6qTgN71au7D_6yk9oGrsueZ.IQo3y7ZdSgh3yQx8fevzAUA9ETG2naF.kUcoPiKwJJRIG6AexckgYNeWeEVmj6DoH3X0vI8j7ykMlyiTMkImKoVvqDqcpL.z_eLjD2Oj; _ga_RBH8S3E0JP=GS2.1.s1769058813$o18$g1$t1769066810$j57$l0$h0';

// 设置Cookie
try {
  const status = cookieManager.setManualCookie(newCookie);
  console.log('Cookie设置成功！');
  console.log('Cookie状态:', status);
} catch (error) {
  console.error('Cookie设置失败:', error.message);
}
