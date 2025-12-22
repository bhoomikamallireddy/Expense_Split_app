const express = require('express');
const app = express();
const userRoutes = require('./routes/users.routes');
const groupRoutes = require('./routes/groups.routes');
const expenseRoutes = require('./routes/expenses.routes'); 

app.use(express.json()); // Allows the app to read JSON data
app.use('/users', userRoutes);
app.use('/groups', groupRoutes);
app.use('/groups', expenseRoutes);
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` Server is running on http://localhost:${PORT}`);
});