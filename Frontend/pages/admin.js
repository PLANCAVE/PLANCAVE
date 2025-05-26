import Dashboard from '../components/admin/Dashboard';
import { getServerSession } from "next-auth";
import { authOptions } from "../../frontend/pages/api/auth/[...nextauth]"; 
import flaskApi from '../lib/flaskApi';

export default function AdminPage({ initialUsers, initialProducts }) {
  return <Dashboard initialUsers={initialUsers} initialProducts={initialProducts} />;
}

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);

  console.log("Session retrieved at AdminPage:", session);
   console.log("User role at AdminPage:", session);

  if (!session || !session.user) {
    return {
      redirect: { destination: "/login?callbackUrl=/admin", permanent: false },
    };
  }

  if (session.user.role !== "admin") {
    return {
      redirect: { destination: "/unauthorized", permanent: false },
    };
  }

  const config = { headers: { Authorization: `Bearer ${session.accessToken}` } };

  try {
    const [usersRes, productsRes] = await Promise.all([
      flaskApi.get("/admin/users", config),
      flaskApi.get("/admin/products", config),
    ]);

    return {
      props: {
        initialUsers: usersRes.data,
        initialProducts: productsRes.data,
      },
    };
  } catch (error) {
    console.error("Failed to fetch admin data:", error);
    return { props: { initialUsers: [], initialProducts: [] } };
  }
}
