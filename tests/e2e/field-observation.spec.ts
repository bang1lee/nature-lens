import { expect, test } from '@playwright/test';
import { openRecordDetails } from './capture-helpers';

test('a visitor keeps separate angle photos, notes, corrected light and a seasonal wish after reopening', async ({
  page,
}) => {
  await page.goto('/embed/');
  await page.getByRole('button', { name: /^사진으로 관찰하기/ }).click();
  await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
  await openRecordDetails(page);
  await page.getByLabel('이름 선택').fill('현장 검사');
  await page.getByRole('button', { name: '내 기록에 저장', exact: true }).click();
  await page.getByRole('button', { name: '내 기록 보기' }).click();

  await page.getByLabel('눈에 보이는 변화').fill('잎 뒷면에 작은 반점');
  await page
    .getByLabel('다른 각도 사진', { exact: true })
    .setInputFiles(['public/icon-192.png', 'public/icon-512.png']);
  await expect(page.getByRole('img', { name: '다른 각도 관찰 사진 2' })).toBeVisible();
  await page.getByRole('button', { name: '사진으로 추정하기' }).click();
  const light = page.getByLabel('사진 밝기 추정');
  await expect(light).not.toHaveValue('');
  await light.selectOption('partial');
  await page.getByRole('button', { name: '관찰 내용 저장' }).click();

  await page.reload();
  await page.getByRole('button', { name: '내 기록', exact: true }).click();
  await page.getByLabel('찾고 싶은 식물', { exact: true }).fill('진달래');
  await page.getByRole('button', { name: '미션 추가', exact: true }).click();
  await page.getByRole('checkbox', { name: /진달래/ }).check();
  await page.getByRole('button', { name: '현장 검사 기록 열기' }).click();
  await expect(page.getByLabel('눈에 보이는 변화')).toHaveValue('잎 뒷면에 작은 반점');
  await expect(light).toHaveValue('partial');
  await expect(page.getByRole('img', { name: /다른 각도 관찰 사진/ })).toHaveCount(2);
  await page.getByRole('button', { name: '사진 1 빼기' }).click();
  await page.getByRole('button', { name: '관찰 내용 저장' }).click();
  await page.reload();
  await page.getByRole('button', { name: '내 기록', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /진달래/ })).toBeChecked();
  await page.getByRole('button', { name: '현장 검사 기록 열기' }).click();
  await expect(page.getByRole('img', { name: /다른 각도 관찰 사진/ })).toHaveCount(1);
});
