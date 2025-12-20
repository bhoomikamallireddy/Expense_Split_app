const express = require('express');
const app = express();
const userRoutes = require('./routes/users.routes');
const groupRoutes = require('./routes/groups.routes'); 

app.use(express.json()); // Allows the app to read JSON data
app.use('/users', userRoutes);
app.use('/groups', groupRoutes);
 
app.listen(PORT, () => {
  console.log(` Server is running on http://localhost:${PORT}`);
});