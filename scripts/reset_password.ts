
import { createClient } from '@supabase/supabase-js'

const url = 'https://gtpcjjjzjjzpgpxwjzqf.supabase.co'
// From .env.local
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0cGNqamp6amp6cGdweHdqenFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU5MDM5NSwiZXhwIjoyMDc5MTY2Mzk1fQ.Q2Zo07VyAFJPKLgaUZTgUkjSJI4UqVwS_6eAsEYVXVI'

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
