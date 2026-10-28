import {expect,type Page} from '@playwright/test';
export async function openRecordDetails(page:Page){
 const details=page.locator('.m-extra-fields');
 await expect(details).toBeAttached();
 if(!(await details.evaluate(node=>node.hasAttribute('open'))))await details.locator('summary').click();
}
export async function gotoReady(page:Page,url:string){
 // External font loading must not decide when the local app is interactive.
 await page.goto(url,{waitUntil:'domcontentloaded'});
 if(new URL(url,'http://127.0.0.1').pathname==='/mobile/')await expect(page.locator('main[data-ready="true"]')).toBeVisible();
 else await expect(page.locator('.m-records[aria-busy="false"]')).toBeVisible();
}
