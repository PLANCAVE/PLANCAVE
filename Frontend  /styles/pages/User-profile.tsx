import { UserProfile } from '@clerk/nextjs';

const ProfilePage = () => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '50px' }}>
      <UserProfile />
    </div>
  );
};

export default ProfilePage;
