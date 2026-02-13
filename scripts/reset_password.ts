
import { createClient } from '@supabase/supabase-js'

const url = 'https://gtpcjjjzjjzpgpxwjzqf.supabase.co'
// From .env.local
const serviceKey = '***REMOVED-SECRET***'

const supabase = createClient(url, serviceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function resetPassword() {
    const email = 'latiefprasetya1211@gmail.com'
    const newPassword = 'password123'
    console.log(`Resetting password for: ${email} to '${newPassword}'`)

    const { data: { users }, error } = await supabase.auth.admin.listUsers()

    if (error) {
        console.error('Error listing users:', error)
        return
    }

    const user = users.find(u => u.email === email)

    if (!user) {
        console.error('User not found!')
        return
    }

    const { data, error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
    )

    if (updateError) {
        console.error('Failed to reset password:', updateError)
    } else {
        console.log('Password reset successfully!')
        console.log('User ID:', data.user.id)
    }
}

resetPassword()
