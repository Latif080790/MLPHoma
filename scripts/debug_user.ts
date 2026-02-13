
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

async function checkUser() {
    const email = 'latiefprasetya1211@gmail.com'
    console.log(`Checking user: ${email}`)

    // Using listUsers to find the user. 
    // Note: listUsers defaults to page 1, perPage 50. If there are many users, we might miss it, 
    // but for a dev project it's likely small.
    const { data, error } = await supabase.auth.admin.listUsers()

    if (error) {
        console.error('Error listing users:', error)
        return
    }

    const users = data.users
    const user = users.find(u => u.email === email)

    if (user) {
        console.log('User found:')
        console.log('ID:', user.id)
        console.log('Email:', user.email)
        console.log('Confirmed At:', user.email_confirmed_at)
        console.log('Last Sign In:', user.last_sign_in_at)
        console.log('Created At:', user.created_at)
        console.log('Role:', user.role)

        if (!user.email_confirmed_at) {
            console.log('WARNING: Email NOT confirmed!')

            // Attempt to auto-confirm for the user to fix their issue
            console.log('Attempting to manually confirm email...')
            const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
                user.id,
                { email_confirm: true }
            )

            if (updateError) {
                console.error('Failed to confirm email:', updateError)
            } else {
                console.log('Email confirmed successfully!')
                console.log('New confirmed at:', updateData.user.email_confirmed_at)
            }

        } else {
            console.log('Email is confirmed.')
        }
    } else {
        console.log('User NOT found.')
    }
}

checkUser()
