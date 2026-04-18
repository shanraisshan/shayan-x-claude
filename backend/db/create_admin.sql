-- Create (or upsert) an admin user directly in auth.users.
--
-- Run this in the Supabase SQL editor. Change the two constants at the top.
-- The password is bcrypt-hashed server-side via pgcrypto's crypt() — never stored as plaintext.
-- Idempotent: re-running updates the password and re-applies the admin role.

do $$
declare
  v_email    text := 'admin@example.com';   -- CHANGE ME
  v_password text := 'ChangeMe123!';        -- CHANGE ME
  v_user_id  uuid;
begin
  select id into v_user_id from auth.users where email = v_email;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',  
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      jsonb_build_object(
        'provider',  'email',
        'providers', jsonb_build_array('email'),
        'role',      'admin'
      ),
      '{}'::jsonb,
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_user_id,
      v_user_id::text,
      'email',
      jsonb_build_object(
        'sub',            v_user_id::text,
        'email',          v_email,
        'email_verified', true,
        'phone_verified', false
      ),
      now(), now(), now()
    );

    raise notice 'created admin user % (id=%)', v_email, v_user_id;
  else
    update auth.users
       set raw_app_meta_data  = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}',
           encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at         = now()
     where id = v_user_id;

    raise notice 'updated admin user % (id=%)', v_email, v_user_id;
  end if;
end $$;
