import { supabase } from './supabase';

/**
 * Cleanly and completely deletes a user and all their related records
 * to avoid foreign key constraint violations, and deletes them from Supabase Auth.
 */
export async function deleteUserComplete(userId: string, email?: string): Promise<void> {
  console.log(`[user-deletion] Starting complete deletion for user: ${userId} (${email || 'no email'})`);

  // 1. Fetch user's conversation IDs
  const { data: convs, error: convsFetchError } = await supabase
    .from('upsa_ai_conversations')
    .select('id')
    .eq('user_id', userId);

  if (convsFetchError) {
    console.error(`[user-deletion] Error fetching conversations:`, convsFetchError);
  }

  const convIds = (convs || []).map((c: any) => c.id);

  // 2. Delete messages inside those conversations
  if (convIds.length > 0) {
    const { error: msgDeleteError } = await supabase
      .from('upsa_ai_messages')
      .delete()
      .in('conversation_id', convIds);
    if (msgDeleteError) {
      console.error(`[user-deletion] Error deleting messages:`, msgDeleteError);
    }
  }

  // 3. Delete conversations
  const { error: convDeleteError } = await supabase
    .from('upsa_ai_conversations')
    .delete()
    .eq('user_id', userId);
  if (convDeleteError) {
    console.error(`[user-deletion] Error deleting conversations:`, convDeleteError);
  }

  // 4. Delete AI queries
  const { error: queriesDeleteError } = await supabase
    .from('upsa_ai_queries')
    .delete()
    .eq('user_id', userId);
  if (queriesDeleteError) {
    console.error(`[user-deletion] Error deleting AI queries:`, queriesDeleteError);
  }

  // 5. Delete bookmarks
  const { error: bookmarksDeleteError } = await supabase
    .from('upsa_bookmarks')
    .delete()
    .eq('user_id', userId);
  if (bookmarksDeleteError) {
    console.error(`[user-deletion] Error deleting bookmarks:`, bookmarksDeleteError);
  }

  // 6. Delete paper reports
  const { error: reportsDeleteError } = await supabase
    .from('upsa_paper_reports')
    .delete()
    .eq('user_id', userId);
  if (reportsDeleteError) {
    console.error(`[user-deletion] Error deleting paper reports:`, reportsDeleteError);
  }

  // 7. Delete student notifications
  const { error: notifsDeleteError } = await supabase
    .from('upsa_notifications')
    .delete()
    .eq('user_id', userId);
  if (notifsDeleteError) {
    console.error(`[user-deletion] Error deleting notifications:`, notifsDeleteError);
  }

  // 8. Handle transactions
  // Try to set user_id to null first to preserve financial history.
  // If it has NOT NULL constraint, fall back to deleting.
  try {
    const { error: txUpdateError } = await supabase
      .from('upsa_transactions')
      .update({ user_id: null })
      .eq('user_id', userId);
    
    if (txUpdateError) {
      console.warn(`[user-deletion] Failed to set user_id to null in transactions (likely NOT NULL constraint). Deleting transactions instead. Error:`, txUpdateError.message);
      const { error: txDeleteError } = await supabase
        .from('upsa_transactions')
        .delete()
        .eq('user_id', userId);
      if (txDeleteError) {
        console.error(`[user-deletion] Error deleting transactions:`, txDeleteError);
      }
    }
  } catch (err: any) {
    console.error(`[user-deletion] Exception updating transactions:`, err);
    await supabase.from('upsa_transactions').delete().eq('user_id', userId);
  }

  // 9. Delete the user from upsa_users
  const { error: userDeleteError } = await supabase
    .from('upsa_users')
    .delete()
    .eq('id', userId);
  
  if (userDeleteError) {
    console.error(`[user-deletion] Error deleting user profile:`, userDeleteError);
    throw userDeleteError;
  }

  // 10. Delete from Supabase Auth (auth.users) if email matches
  if (email) {
    try {
      const { data: authUsersResult, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        console.error(`[user-deletion] Error listing auth users:`, listError);
      } else {
        const authUser = authUsersResult?.users?.find(
          (u: any) => u.email?.toLowerCase() === email.toLowerCase()
        );
        if (authUser) {
          console.log(`[user-deletion] Deleting matching auth user: ${authUser.id}`);
          const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authUser.id);
          if (deleteAuthError) {
            console.error(`[user-deletion] Error deleting auth user:`, deleteAuthError);
          } else {
            console.log(`[user-deletion] Successfully deleted auth user: ${authUser.id}`);
          }
        }
      }
    } catch (authErr) {
      console.error(`[user-deletion] Exception during auth user deletion:`, authErr);
    }
  }

  console.log(`[user-deletion] Completed complete deletion for user: ${userId}`);
}
