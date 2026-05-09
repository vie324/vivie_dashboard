-- subscription_plans / members / member_subscriptions の書き込みポリシーを
-- 認証済ユーザー全員に開放 (service_role が万一バイパスしない場合の保険)
--
-- これらのテーブルは Square 連携で自動取り込みされる + 管理画面でも編集可能。
-- 公開 API には晒されないので authenticated 全員に書ける形でも実害なし。

drop policy if exists "admin write plans" on public.subscription_plans;
drop policy if exists "auth read plans" on public.subscription_plans;
create policy "auth all plans" on public.subscription_plans
  for all to authenticated
  using (true) with check (true);

drop policy if exists "auth read members" on public.members;
drop policy if exists "auth write members" on public.members;
create policy "auth all members" on public.members
  for all to authenticated
  using (true) with check (true);

drop policy if exists "auth read member_subs" on public.member_subscriptions;
drop policy if exists "auth write member_subs" on public.member_subscriptions;
create policy "auth all member_subs" on public.member_subscriptions
  for all to authenticated
  using (true) with check (true);

-- visits も同様
drop policy if exists "auth read visits" on public.visits;
drop policy if exists "auth write visits" on public.visits;
create policy "auth all visits" on public.visits
  for all to authenticated
  using (true) with check (true);

-- cashbook_entries も同様
drop policy if exists "auth read cashbook" on public.cashbook_entries;
drop policy if exists "auth write cashbook" on public.cashbook_entries;
create policy "auth all cashbook" on public.cashbook_entries
  for all to authenticated
  using (true) with check (true);

-- stores: 読み取りは全員、書き込みは admin のみ
drop policy if exists "auth read stores" on public.stores;
drop policy if exists "admin write stores" on public.stores;
create policy "auth read stores" on public.stores
  for select to authenticated using (true);
create policy "admin manage stores" on public.stores
  for insert to authenticated with check (public.is_admin());
create policy "admin update stores" on public.stores
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete stores" on public.stores
  for delete to authenticated using (public.is_admin());

-- staff: 読み取りは全員、自身の更新は誰でも、admin による管理は分離
drop policy if exists "auth read staff" on public.staff;
drop policy if exists "self update staff" on public.staff;
drop policy if exists "admin write staff" on public.staff;
create policy "auth read staff" on public.staff
  for select to authenticated using (true);
create policy "self update staff" on public.staff
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "admin insert staff" on public.staff
  for insert to authenticated with check (public.is_admin());
create policy "admin delete staff" on public.staff
  for delete to authenticated using (public.is_admin());

-- staff_stores も
drop policy if exists "auth read staff_stores" on public.staff_stores;
drop policy if exists "admin write staff_stores" on public.staff_stores;
create policy "auth read staff_stores" on public.staff_stores
  for select to authenticated using (true);
create policy "admin write staff_stores" on public.staff_stores
  for insert to authenticated with check (public.is_admin());
create policy "admin delete staff_stores" on public.staff_stores
  for delete to authenticated using (public.is_admin());
