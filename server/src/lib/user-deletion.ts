import { supabase } from './supabase';

/**
 * Cleanly and completely deletes a user and all their related records
 * to avoid foreign key constraint violations, and deletes them from Supabase Auth.
 */
export async function deleteUserComplete(userId: string, email?: string): Promise<void> {
  console.log(`[user-deletion] Starting complete deletion for user: ${userId} (${email || 'no email'})`);

  // Helper: safely attempt a deletion step, log errors but don't abort the chain
  const safeDelete = async (label: string, fn: () => PromiseLike<any>) => {
    try {
      const { error } = await fn();
      if (error) {
        console.error(`[user-deletion] ⚠️ Error in step "${label}":`, error.message || error);
      } else {
        console.log(`[user-deletion] ✅ ${label}`);
      }
    } catch (err: any) {
      console.error(`[user-deletion] ⚠️ Exception in step "${label}":`, err?.message || err);
    }
  };

  // 1. Fetch user's conversation IDs first
  let convIds: string[] = [];
  try {
    const { data: convs, error: convsFetchError } = await supabase
      .from('upsa_ai_conversations')
      .select('id')
      .eq('user_id', userId);

    if (convsFetchError) {
      console.error(`[user-deletion] Error fetching conversations:`, convsFetchError.message);
    } else {
      convIds = (convs || []).map((c: any) => c.id);
    }
  } catch (err: any) {
    console.error(`[user-deletion] Exception fetching conversations:`, err?.message || err);
  }

  // 2. Delete messages inside those conversations
  if (convIds.length > 0) {
    await safeDelete('Delete AI messages', () =>
      supabase.from('upsa_ai_messages').delete().in('conversation_id', convIds)
    );
  }

  // 3. Delete conversations
  await safeDelete('Delete AI conversations', () =>
    supabase.from('upsa_ai_conversations').delete().eq('user_id', userId)
  );

  // 4. Delete AI queries
  await safeDelete('Delete AI queries', () =>
    supabase.from('upsa_ai_queries').delete().eq('user_id', userId)
  );

  // 5. Delete bookmarks
  await safeDelete('Delete bookmarks', () =>
    supabase.from('upsa_bookmarks').delete().eq('user_id', userId)
  );

  // 6. Delete paper reports
  await safeDelete('Delete paper reports', () =>
    supabase.from('upsa_paper_reports').delete().eq('user_id', userId)
  );

  // 7. Delete student notifications
  await safeDelete('Delete notifications', () =>
    supabase.from('upsa_notifications').delete().eq('user_id', userId)
  );

  // 8. Handle transactions — try nulling user_id first to preserve financial history,
  //    fall back to deleting if column has NOT NULL constraint.
  try {
    const { error: txUpdateError } = await supabase
      .from('upsa_transactions')
      .update({ user_id: null })
      .eq('user_id', userId);

    if (txUpdateError) {
      console.warn(`[user-deletion] Transactions: null update failed (${txUpdateError.message}), falling back to delete.`);
      await safeDelete('Delete transactions (fallback)', () =>
        supabase.from('upsa_transactions').delete().eq('user_id', userId)
      );
    } else {
      console.log(`[user-deletion] ✅ Nulled user_id in transactions`);
    }
  } catch (err: any) {
    console.error(`[user-deletion] Exception handling transactions:`, err?.message || err);
    await safeDelete('Delete transactions (exception fallback)', () =>
      supabase.from('upsa_transactions').delete().eq('user_id', userId)
    );
  }

  // 8.5 If an email is provided, clean up any existing archived record for this email
  // to avoid trigger unique constraint failures (upsa_deleted_accounts_email_unique)
  if (email) {
    await safeDelete('Clean up old archived record for email', () =>
      supabase.from('upsa_deleted_accounts').delete().eq('email', email)
    );
  }

  // 9. Delete the user profile — this is the critical step; throw on failure
  console.log(`[user-deletion] Deleting upsa_users record for ${userId}...`);
  const { error: userDeleteError } = await supabase
    .from('upsa_users')
    .delete()
    .eq('id', userId);

  if (userDeleteError) {
    console.error(`[user-deletion] ❌ CRITICAL: Failed to delete user profile:`, userDeleteError.message || userDeleteError);
    throw new Error(`Failed to delete user from database: ${userDeleteError.message}`);
  }

  console.log(`[user-deletion] ✅ Deleted upsa_users record`);

  // 10. Delete from Supabase Auth using direct ID lookup — much faster than listUsers()
  try {
    // First try by UUID (works for password-based users whose UUID matches upsa_users.id)
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      // If direct ID deletion fails, it might be an OAuth user with a different auth UUID
      // In that case, try to find them by email
      if (email) {
        console.warn(`[user-deletion] Direct auth delete failed (${deleteAuthError.message}), trying email lookup...`);
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (!listError && users) {
          const authUser = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
          if (authUser && authUser.id !== userId) {
            const { error: deleteByEmailError } = await supabase.auth.admin.deleteUser(authUser.id);
            if (deleteByEmailError) {
              console.error(`[user-deletion] ⚠️ Failed to delete auth user by email:`, deleteByEmailError.message);
            } else {
              console.log(`[user-deletion] ✅ Deleted auth user by email fallback: ${authUser.id}`);
            }
          }
        }
      } else {
        console.warn(`[user-deletion] ⚠️ Auth delete failed and no email for fallback:`, deleteAuthError.message);
      }
    } else {
      console.log(`[user-deletion] ✅ Deleted Supabase auth user: ${userId}`);
    }
  } catch (authErr: any) {
    // Auth deletion failure is non-critical — the DB record is already gone
    console.warn(`[user-deletion] ⚠️ Auth deletion exception (non-fatal):`, authErr?.message || authErr);
  }

  console.log(`[user-deletion] ✅ Completed full deletion for user: ${userId}`);
}
